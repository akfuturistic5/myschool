
import { useState, useEffect, useMemo } from 'react'
import ImageWithBasePath from '../../../core/common/imageWithBasePath'
import { Link } from 'react-router-dom'
import { all_routes } from '../../router/all_routes'
import { paymentType } from '../../../core/common/selectoption/selectoption'
import { DatePicker } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from "dayjs"
import Select from 'react-select'
import type { SingleValue } from 'react-select'
import { apiService } from '../../../core/services/apiService'
import { useLeaveTypes } from '../../../core/hooks/useLeaveTypes'
import { useFeeStructures } from '../../../core/hooks/useFeeStructures'
import { useStudentFees } from '../../../core/hooks/useStudentFees'

interface StudentModalsProps {
  studentId?: number | null
  onLeaveApplied?: () => void
  /** Student object for Add Fees modal - real data instead of dummy */
  student?: { id?: number; admission_number?: string; first_name?: string; last_name?: string; class_name?: string; section_name?: string; photo_url?: string | null } | null
  /** Fee data from useStudentFees - totalOutstanding, totalDue, etc. */
  feeData?: { totalOutstanding?: number; totalDue?: number; totalPaid?: number; structures?: Array<{ feeStructureId: number; feeName: string; feeType: string; dueAmount: number; outstanding: number }> } | null
  /** Callback after fee collected successfully */
  onFeeCollected?: () => void
}

const StudentModals = ({ studentId, onLeaveApplied, student, feeData, onFeeCollected }: StudentModalsProps) => {
  const routes = all_routes
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const formattedDate = `${month}-${day}-${year}`
  const defaultValue = dayjs(formattedDate)

  const { leaveTypes } = useLeaveTypes()
  const leaveTypeOptions = leaveTypes.length > 0 ? leaveTypes : []
  const { feeStructures } = useFeeStructures()
  const { data: fetchedFeeData } = useStudentFees(student?.id ?? null)
  const effectiveFeeData = feeData ?? fetchedFeeData ?? null

  const [applyLeaveType, setApplyLeaveType] = useState<SingleValue<{ value: string; label: string }>>(null)
  const [applyFromDate, setApplyFromDate] = useState<Dayjs | null>(null)
  const [applyToDate, setApplyToDate] = useState<Dayjs | null>(null)
  const [applyReason, setApplyReason] = useState('')
  const [applySubmitting, setApplySubmitting] = useState(false)
  const getModalContainer = () => document.body;

  // Add Fees form state
  const [feeStructureId, setFeeStructureId] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [collectionDate, setCollectionDate] = useState<Dayjs | null>(defaultValue)
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentRefNo, setPaymentRefNo] = useState('')
  const [remarks, setRemarks] = useState('')
  const [feeSubmitting, setFeeSubmitting] = useState(false)

  const feeStructureOptions = feeStructures.map((fs) => ({
    value: String(fs.id),
    label: `${fs.feeName} (${fs.feeType}) - $${fs.amount?.toFixed(2) ?? '0'}`,
  }))
  const paymentOptions = paymentType.map((p) => ({ value: p.value, label: p.label }))

  // Login details (usernames) for parent & student
  const [loginRows, setLoginRows] = useState<Array<{ userType: string; username: string | null; phone?: string | null; email?: string | null }>>([])
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    if (!student?.id) {
      setLoginRows([])
      setLoginError(null)
      setLoginLoading(false)
      return
    }
    let mounted = true
    setLoginLoading(true)
    setLoginError(null)
    apiService
      .getStudentLoginDetails(student.id)
      .then((res: any) => {
        if (!mounted) return
        if (res?.status === 'SUCCESS' && res.data) {
          const d = res.data
          const rows: Array<{ userType: string; username: string | null; phone?: string | null; email?: string | null }> = []
          if (Array.isArray(d.parents)) {
            d.parents.forEach((p: any) => {
              rows.push({
                userType: p.userType || 'Parent',
                username: p.username ?? null,
                phone: p.phone ?? null,
                email: p.email ?? null,
              })
            })
          }
          if (d.student) {
            rows.push({
              userType: d.student.userType || 'Student',
              username: d.student.username ?? null,
              phone: d.student.phone ?? null,
              email: d.student.email ?? null,
            })
          }
          setLoginRows(rows)
        } else {
          setLoginRows([])
        }
      })
      .catch((err: any) => {
        if (!mounted) return
        setLoginError(err?.message || 'Failed to fetch login details')
        setLoginRows([])
      })
      .finally(() => {
        if (mounted) setLoginLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [student?.id])

  const maskedLoginRows = useMemo(
    () =>
      loginRows.map((row) => {
        const maskValue = (val?: string | null) => {
          const v = (val || '').toString().trim()
          if (!v) return ''
          if (/^\d{6,}$/.test(v)) {
            // phone-like: show last 3 digits only
            return `Phone ending ${v.slice(-3)}`
          }
          const atIdx = v.indexOf('@')
          if (atIdx > 1) {
            return `${v[0]}***${v.slice(atIdx)}`
          }
          return 'Configured by admin'
        }
        const hint = row.phone || row.email || null
        return {
          ...row,
          passwordHint: hint ? maskValue(hint) : 'Use existing password',
        }
      }),
    [loginRows]
  )

  useEffect(() => {
    if (student && feeStructureOptions.length > 0 && !feeStructureId) {
      const firstForStudent = effectiveFeeData?.structures?.[0] ?? feeStructures[0]
      if (firstForStudent) {
        const id = String(firstForStudent.feeStructureId ?? (firstForStudent as any).id)
        setFeeStructureId(id)
        const amt = (firstForStudent as any).outstanding ?? (firstForStudent as any).amount ?? firstForStudent.dueAmount
        if (amt != null && amt > 0) setAmountPaid(String(amt))
      }
    }
  }, [student, feeStructureOptions, effectiveFeeData?.structures, feeStructures])

  const hideAddFeesModal = () => {
    const el = document.getElementById('add_fees_collect')
    if (el) {
      const bsModal = (window as any).bootstrap?.Modal?.getInstance(el)
      if (bsModal) bsModal.hide()
    }
  }

  const handleAddFeesSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!student?.id) {
      alert('Please select a student to collect fees for.')
      return
    }
    if (!feeStructureId) {
      alert('Please select a Fee Type.')
      return
    }
    const amt = parseFloat(amountPaid)
    if (Number.isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.')
      return
    }
    setFeeSubmitting(true)
    try {
      const res = await apiService.createFeeCollection({
        student_id: student.id,
        fee_structure_id: Number(feeStructureId),
        amount_paid: amt,
        payment_date: collectionDate ? collectionDate.format('YYYY-MM-DD') : new Date().toISOString().slice(0, 10),
        payment_method: paymentMethod || 'cash',
        receipt_number: paymentRefNo.trim() || null,
        transaction_id: paymentRefNo.trim() || null,
        remarks: remarks.trim() || null,
      })
      if (res?.status === 'SUCCESS') {
        onFeeCollected?.()
        hideAddFeesModal()
        setFeeStructureId('')
        setAmountPaid('')
        setCollectionDate(defaultValue)
        setPaymentMethod('cash')
        setPaymentRefNo('')
        setRemarks('')
      } else {
        alert(res?.message || 'Failed to collect fee.')
      }
    } catch (err: any) {
      let msg = err?.message || 'Failed to collect fee.'
      try {
        const m = msg.match(/\{[\s\S]*\}/)
        if (m) {
          const j = JSON.parse(m[0])
          if (j.detail) msg = `${j.message || msg}\n\nDetail: ${j.detail}`
        }
      } catch (_) {
        // ignore
      }
      alert(msg)
    } finally {
      setFeeSubmitting(false)
    }
  }

  const hideApplyLeaveModal = () => {
    const el = document.getElementById('apply_leave');
    if (el) {
      const bsModal = (window as any).bootstrap?.Modal?.getInstance(el);
      if (bsModal) bsModal.hide();
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentId) {
      alert('Please select a student to apply leave for.')
      return
    }
    const typeId = applyLeaveType?.value
    if (!typeId) {
      alert('Please select Leave Type.')
      return
    }
    if (!applyFromDate || !applyToDate) {
      alert('Please select From Date and To Date.')
      return
    }
    const fromStr = applyFromDate.format('YYYY-MM-DD')
    const toStr = applyToDate.format('YYYY-MM-DD')
    if (toStr < fromStr) {
      alert('To Date must be on or after From Date.')
      return
    }
    setApplySubmitting(true)
    try {
      const res = await apiService.createLeaveApplication({
        leave_type_id: Number(typeId),
        student_id: studentId,
        start_date: fromStr,
        end_date: toStr,
        reason: applyReason.trim() || null,
      })
      if (res?.status === 'SUCCESS') {
        onLeaveApplied?.()
        hideApplyLeaveModal()
        setApplyLeaveType(null)
        setApplyFromDate(null)
        setApplyToDate(null)
        setApplyReason('')
      } else {
        alert(res?.message || 'Failed to apply leave.')
      }
    } catch (err: any) {
      let msg = err?.message || 'Failed to apply leave.'
      try {
        const m = msg.match(/\{[\s\S]*\}/)
        if (m) {
          const j = JSON.parse(m[0])
          if (j.detail) msg = `${j.message || msg}\n\nDetail: ${j.detail}`
        }
      } catch (_) {
        // ignore
      }
      alert(msg)
    } finally {
      setApplySubmitting(false)
    }
  }
  return (
    <>
      {/* Add Fees Collect */}
      <div className="modal fade" id="add_fees_collect">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <div className="d-flex align-items-center">
                <h4 className="modal-title">Collect Fees</h4>
                {student?.admission_number && (
                  <span className="badge badge-sm bg-primary ms-2">{student.admission_number}</span>
                )}
              </div>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleAddFeesSubmit}>
              <div id="modal-datepicker" className="modal-body">
                {student ? (
                  <>
                    <div className="bg-light-300 p-3 pb-0 rounded mb-4">
                      <div className="row align-items-center">
                        <div className="col-lg-3 col-md-6">
                          <div className="d-flex align-items-center mb-3">
                            <Link to={student?.id ? `${routes.studentDetail}/${student.id}` : routes.studentList} state={student ? { student } : undefined} className="avatar avatar-md me-2">
                              <ImageWithBasePath src={student.photo_url || 'assets/img/students/student-01.jpg'} alt="img" />
                            </Link>
                            <Link to={student?.id ? `${routes.studentDetail}/${student.id}` : routes.studentList} state={student ? { student } : undefined} className="d-flex flex-column">
                              <span className="text-dark">{[student.first_name, student.last_name].filter(Boolean).join(' ') || 'N/A'}</span>
                              {student.class_name && student.section_name ? `${student.class_name}, ${student.section_name}` : student.class_name || student.section_name || '-'}
                            </Link>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <span className="fs-12 mb-1">Total Outstanding</span>
                            <p className="text-dark">{effectiveFeeData?.totalOutstanding != null ? effectiveFeeData.totalOutstanding.toFixed(2) : '0.00'}</p>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <span className="fs-12 mb-1">Last Date</span>
                            <p className="text-dark">
                              {effectiveFeeData?.structures?.[0]
                                ? (effectiveFeeData.structures[0] as any).dueDate
                                  ? new Date((effectiveFeeData.structures[0] as any).dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                  : '-'
                                : '-'}
                            </p>
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <span className={`badge badge-soft-${(effectiveFeeData?.totalOutstanding ?? 0) > 0 ? 'danger' : 'success'}`}>
                              <i className="ti ti-circle-filled me-2" />
                              {(effectiveFeeData?.totalOutstanding ?? 0) > 0 ? 'Unpaid' : 'Paid'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">Fees Type</label>
                          <Select
                            classNamePrefix="react-select"
                            className="select"
                            options={feeStructureOptions}
                            value={feeStructureOptions.find((o) => o.value === feeStructureId) ?? null}
                            onChange={(opt) => {
                              setFeeStructureId(opt?.value ?? '')
                              const fs = feeStructures.find((f) => String(f.id) === opt?.value)
                              if (fs && fs.amount != null) setAmountPaid(String(fs.amount))
                            }}
                            placeholder="Select Fee Type"
                            isClearable
                          />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control"
                            placeholder="Enter Amount"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">Collection Date</label>
                          <div className="date-pic">
                            <DatePicker
                              className="form-control datetimepicker"
                              format="DD-MM-YYYY"
                              getPopupContainer={getModalContainer}
                              value={collectionDate}
                              onChange={(d) => setCollectionDate(d)}
                              placeholder="Select date"
                            />
                            <span className="cal-icon"><i className="ti ti-calendar" /></span>
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6">
                        <div className="mb-3">
                          <label className="form-label">Payment Type</label>
                          <Select
                            classNamePrefix="react-select"
                            className="select"
                            options={paymentOptions}
                            value={paymentOptions.find((o) => o.value === paymentMethod) ?? paymentOptions[0]}
                            onChange={(opt) => setPaymentMethod(opt?.value ?? 'Cash')}
                            placeholder="Select Payment Type"
                          />
                        </div>
                      </div>
                      <div className="col-lg-12">
                        <div className="mb-3">
                          <label className="form-label">Payment Reference No</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter Payment Reference No (optional)"
                            value={paymentRefNo}
                            onChange={(e) => setPaymentRefNo(e.target.value)}
                          />
                        </div>
                        <div className="col-lg-12">
                          <div className="mb-0">
                            <label className="form-label">Remarks</label>
                            <textarea
                              rows={2}
                              className="form-control"
                              placeholder="Add remarks (optional)"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted">
                    <p>Please open a student&apos;s detail page and click &quot;Add Fees&quot;, or go to Fees Collection to collect fees for a student.</p>
                  </div>
                )}
              </div>
              {student && (
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={feeSubmitting || !feeStructureId || !amountPaid}>
                    {feeSubmitting ? 'Processing...' : 'Pay Fees'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
      {/* Add Fees Collect */}
      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>
                  You want to delete all the marked items, this cant be undone once
                  you delete.
                </p>
                <div className="d-flex justify-content-center">
                  <Link
                    to="#"
                    className="btn btn-light me-3"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link to="#" className="btn btn-danger" data-bs-dismiss="modal">
                    Yes, Delete
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Delete Modal */}

      <>
        {/* Login Details */}
        <div className="modal fade" id="login_detail">
          <div className="modal-dialog modal-dialog-centered  modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Login Details</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <div className="modal-body">
                <div className="student-detail-info">
                  <span className="student-img">
                    <ImageWithBasePath src={student?.photo_url || 'assets/img/students/student-01.jpg'} alt="Img" />
                  </span>
                  <div className="name-info">
                    <h6>
                      {[student?.first_name, student?.last_name].filter(Boolean).join(' ') || 'Student'}
                      {(student?.class_name || student?.section_name) && (
                        <span>
                          {' '}
                          {(student?.class_name && student?.section_name)
                            ? `${student.class_name}, ${student.section_name}`
                            : (student?.class_name || student?.section_name)}
                        </span>
                      )}
                    </h6>
                  </div>
                </div>
                <div className="table-responsive custom-table no-datatable_length">
                  <table className="table datanew">
                    <thead className="thead-light">
                      <tr>
                        <th>User Type</th>
                        <th>User Name</th>
                        <th>Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLoading && (
                        <tr>
                          <td colSpan={3}>Loading login details...</td>
                        </tr>
                      )}
                      {!loginLoading && loginError && (
                        <tr>
                          <td colSpan={3}>{loginError}</td>
                        </tr>
                      )}
                      {!loginLoading && !loginError && maskedLoginRows.length === 0 && (
                        <tr>
                          <td colSpan={3}>No login accounts found for this student.</td>
                        </tr>
                      )}
                      {!loginLoading &&
                        !loginError &&
                        maskedLoginRows.map((row, idx) => (
                          <tr key={`${row.userType}-${row.username || idx}`}>
                            <td>{row.userType}</td>
                            <td>{row.username || 'N/A'}</td>
                            <td>{row.passwordHint}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* /Login Details */}
      </>
      <>
        {/* Apply Leave */}
        <div className="modal fade" id="apply_leave">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Apply Leave</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleApplyLeaveSubmit}>
                <div id="modal-datepicker" className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Leave Type</label>
                        <Select
                          classNamePrefix="react-select"
                          className="select"
                          options={leaveTypeOptions}
                          value={applyLeaveType}
                          onChange={setApplyLeaveType}
                          placeholder="Select Leave Type"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Leave From Date</label>
                        <div className="date-pic">
                          <DatePicker
                            className="form-control datetimepicker"
                            format="DD-MM-YYYY"
                            getPopupContainer={getModalContainer}
                            value={applyFromDate}
                            onChange={(d) => setApplyFromDate(d)}
                            placeholder="Select date"
                          />
                          <span className="cal-icon"><i className="ti ti-calendar" /></span>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Leave To Date</label>
                        <div className="date-pic">
                          <DatePicker
                            className="form-control datetimepicker"
                            format="DD-MM-YYYY"
                            getPopupContainer={getModalContainer}
                            value={applyToDate}
                            onChange={(d) => setApplyToDate(d)}
                            placeholder="Select date"
                          />
                          <span className="cal-icon"><i className="ti ti-calendar" /></span>
                        </div>
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Reason</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter reason (optional)"
                          value={applyReason}
                          onChange={(e) => setApplyReason(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={applySubmitting || !studentId}>
                    {applySubmitting ? 'Submitting...' : 'Apply Leave'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Apply Leave */}
      </>

    </>

  )
}

export default StudentModals
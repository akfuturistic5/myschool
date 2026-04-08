import { Navigate, Route } from "react-router";
import React from "react";
import { all_routes } from "./all_routes";
import Login from "../auth/login/login";
import Register from "../auth/register/register";
import TwoStepVerification from "../auth/twoStepVerification/twoStepVerification";
import EmailVerification from "../auth/emailVerification/emailVerification";
import ResetPassword from "../auth/resetPassword/resetPassword";
import ForgotPassword from "../auth/forgotPassword/forgotPassword";
import Login2 from "../auth/login/login-2";
import Login3 from "../auth/login/login-3";
import ResetPassword2 from "../auth/resetPassword/resetPassword-2";
import ResetPassword3 from "../auth/resetPassword/resetPassword-3";
import TwoStepVerification2 from "../auth/twoStepVerification/twoStepVerification-2";
import TwoStepVerification3 from "../auth/twoStepVerification/twoStepVerification-3";
import Register2 from "../auth/register/register-2";
import Register3 from "../auth/register/register-3";
import ForgotPassword2 from "../auth/forgotPassword/forgotPassword-2";
import ForgotPassword3 from "../auth/forgotPassword/forgotPassword-3";
import ResetPasswordSuccess from "../auth/resetPasswordSuccess/resetPasswordSuccess";
import ResetPasswordSuccess2 from "../auth/resetPasswordSuccess/resetPasswordSuccess-2";
import ResetPasswordSuccess3 from "../auth/resetPasswordSuccess/resetPasswordSuccess-3";
import LockScreen from "../auth/lockScreen";
import EmailVerification2 from "../auth/emailVerification/emailVerification-2";
import EmailVerification3 from "../auth/emailVerification/emailVerification-3";
import AdminDashboard from "../mainMenu/adminDashboard";
import AdministrativeDashboard from "../mainMenu/administrativeDashboard";
import ParentDashboard from "../mainMenu/parentDashboard";
import GuardianDashboard from "../mainMenu/guardianDashboard";
import TeacherDashboard from "../mainMenu/teacherDashboard";
const StudentDasboard = React.lazy(() => import("../mainMenu/studentDashboard"));
import AudioCall from "../application/call/audioCall";
import CallHistory from "../application/call/callHistory";
import Videocall from "../application/call/videoCall";
import ConferenceCall from "../application/call/conferenceCall";
import Chat from "../application/chat";
import Email from "../application/email";
import FileManager from "../application/fileManager";
import Todo from "../application/todo";
import Calendar from "../mainMenu/apps/calendar";
import Notes from "../application/notes";
import Error404 from "../pages/error/error-404";
import Error500 from "../pages/error/error-500";
import Ribbon from "antd/es/badge/Ribbon";
import AcademicReason from "../academic/academic-reason";
import ClassHomeWork from "../academic/class-home-work";
import ClassRoom from "../academic/class-room";
import ClassRoutine from "../academic/class-routine";
import ClassSection from "../academic/class-section";
import ClassSubject from "../academic/class-subject";
import ClassSyllabus from "../academic/class-syllabus";
import ClassTimetable from "../academic/class-timetable";
import Classes from "../academic/classes";
import AcademicYearsList from "../academic/academic-years";
import AcademicYearCreate from "../academic/academic-years/create";
import AcademicYearDetail from "../academic/academic-years/detail";
import Exam from "../academic/examinations/exam";
import ExamAttendance from "../academic/examinations/exam-attendance";
import ExamResult from "../academic/examinations/exam-results";
import ExamSchedule from "../academic/examinations/exam-schedule";
import Grade from "../academic/examinations/grade";
import ScheduleClasses from "../academic/schedule-classes";
import AccountsIncome from "../accounts/accounts-income";
import AccountsInvoices from "../accounts/accounts-invoices";
import AccountsTransactions from "../accounts/accounts-transactions";
import AddInvoice from "../accounts/add-invoice";
import EditInvoice from "../accounts/edit-invoice";
import Expense from "../accounts/expense";
import ExpensesCategory from "../accounts/expenses-category";
import Invoice from "../accounts/invoice";
import Events from "../announcements/events";
import NoticeBoard from "../announcements/notice-board";
import AllBlogs from "../content/blog/allBlogs";
import BlogCategories from "../content/blog/blogCategories";
import BlogComments from "../content/blog/blogComments";
import BlogTags from "../content/blog/blogTags";
import Faq from "../content/faq";
import Cities from "../content/location/cities";
import Countries from "../content/location/countries";
import States from "../content/location/states";
import Pages from "../content/pages";
import Testimonials from "../content/testimonials";
import StaffAttendance from "../hrm/attendance/staff-attendance";
import StudentAttendance from "../hrm/attendance/student-attendance";

import Departments from "../hrm/departments";
import Designation from "../hrm/designation";
import Holiday from "../hrm/holidays";
import ApproveRequest from "../hrm/leaves/approve-request";
import ListLeaves from "../hrm/leaves/list-leaves";
import Payroll from "../hrm/payroll";
import AddStaff from "../hrm/staff-list/add-staff";
import EditStaff from "../hrm/staff-list/edit-staff";
import Staff from "../hrm/staff-list/staff";
import StaffDetails from "../hrm/staff-list/staff-details.tsx";
import StaffLeave from "../hrm/staff-list/staff-leave";
import StaffPayRoll from "../hrm/staff-list/staff-payroll.tsx";
import StaffsAttendance from "../hrm/staff-list/staffs-attendance";
import CollectFees from "../management/feescollection/collectFees";
import FeesAssign from "../management/feescollection/feesAssign";
import FeesGroup from "../management/feescollection/feesGroup";
import FeesMaster from "../management/feescollection/feesMaster";
import FeesTypes from "../management/feescollection/feesTypes";
import HostelList from "../management/hostel/hostelList";
import HostelRooms from "../management/hostel/hostelRooms";
import HostelType from "../management/hostel/hostelType";
import Books from "../management/library/books";
import IssueBook from "../management/library/issuesBook";
import LibraryMember from "../management/library/libraryMember";
import ReturnBook from "../management/library/returnBook";
import PlayersList from "../management/sports/playersList";
import SportsList from "../management/sports/sportsList";
import TransportAssignVehicle from "../management/transport/transportAssignVehicle";
import TransportPickupPoints from "../management/transport/transportPickupPoints";
import TransportRoutes from "../management/transport/transportRoutes";
import TransportVehicle from "../management/transport/transportVehicle";
import TransportVehicleDrivers from "../management/transport/transportVehicleDrivers";
import MembershipAddon from "../membership/membershipaddon";
import Membershipplan from "../membership/membershipplan";
import MembershipTransaction from "../membership/membershiptrasaction";
import BlankPage from "../pages/blankPage";
import ComingSoon from "../pages/comingSoon";
import Profile from "../pages/profile";
import NotificationActivities from "../pages/profile/activities";
import UnderMaintenance from "../pages/underMaintenance";
import GuardianGrid from "../peoples/guardian/guardian-grid";
import GuardianList from "../peoples/guardian/guardian-list";
import ParentGridPage from "../peoples/parent/parent-grid/ParentGridPage";
import ParentListPage from "../peoples/parent/parent-list/ParentListPage";
import AddStudent from "../peoples/students/add-student";
import StudentDetails from "../peoples/students/student-details/studentDetails";
import StudentFees from "../peoples/students/student-details/studentFees";
import StudentLeaves from "../peoples/students/student-details/studentLeaves";
import StudentLibrary from "../peoples/students/student-details/studentLibrary";
import StudentResult from "../peoples/students/student-details/studentResult";
import StudentTimeTable from "../peoples/students/student-details/studentTimeTable";
import StudentList from "../peoples/students/student-list";
import StudentPromotion from "../peoples/students/student-promotion";
import TeacherDetails from "../peoples/teacher/teacher-details/teacherDetails";
import TeacherLeave from "../peoples/teacher/teacher-details/teacherLeave";
import TeacherLibrary from "../peoples/teacher/teacher-details/teacherLibrary";
import AdministrativeDetails from "../peoples/administrative/administrative-details/administrativeDetails";
import AdministrativeLeave from "../peoples/administrative/administrative-details/administrativeLeave";
import TeacherSalary from "../peoples/teacher/teacher-details/teacherSalary";
import TeachersRoutine from "../peoples/teacher/teacher-details/teachersRoutine";
import TeacherGrid from "../peoples/teacher/teacher-grid";
import TeacherList from "../peoples/teacher/teacher-list";
import TeacherForm from "../peoples/teacher/teacherForm";
import AttendanceReport from "../report/attendance-report/attendanceReport";
import DailyAttendance from "../report/attendance-report/dailyAttendance";
import StaffDayWise from "../report/attendance-report/staffDayWise";
import StaffReport from "../report/attendance-report/staffReport";
import StudentAttendanceType from "../report/attendance-report/studentAttendanceType";
import StudentDayWise from "../report/attendance-report/studentDayWise";
import TeacherDayWise from "../report/attendance-report/teacherDayWise";
import TeacherReport from "../report/attendance-report/teacherReport";
import ClassReport from "../report/class-report/classReport";
import FeesReport from "../report/fees-report/feesReport";
import GradeReport from "../report/grade-report/gradeReport";
import LeaveReport from "../report/leave-report/leaveReport";
import StudentReport from "../report/student-report/studentReport";
import Religion from "../settings/academicSettings/religion";
import SchoolSettings from "../settings/academicSettings/schoolSettings";
import CustomFields from "../settings/appSettings/customFields";
import InvoiceSettings from "../settings/appSettings/invoiceSettings";
import PaymentGateways from "../settings/financialSettings/paymentGateways";
import TaxRates from "../settings/financialSettings/taxRates";
import ConnectedApps from "../settings/generalSettings/connectedApps";
import Notificationssettings from "../settings/generalSettings/notifications";
import Securitysettings from "../settings/generalSettings/security";
import BanIpAddress from "../settings/otherSettings/banIpaddress";
import Emailtemplates from "../settings/systemSettings/email-templates";
import EmailSettings from "../settings/systemSettings/emailSettings";
import GdprCookies from "../settings/systemSettings/gdprCookies";
import OtpSettings from "../settings/systemSettings/otp-settings";
import SmsSettings from "../settings/systemSettings/smsSettings";
import CompanySettings from "../settings/websiteSettings/companySettings";
import Languagesettings from "../settings/websiteSettings/language";
import Localization from "../settings/websiteSettings/localization";
import Preference from "../settings/websiteSettings/preference";
import Prefixes from "../settings/websiteSettings/prefixes";
import Socialauthentication from "../settings/websiteSettings/socialAuthentication";
import ContactMessages from "../support/contactMessages";
import TicketDetails from "../support/ticket-details";
import TicketGrid from "../support/ticket-grid";
import Tickets from "../support/tickets";
import ClipBoard from "../uiInterface/advanced-ui/clipboard";
import Counter from "../uiInterface/advanced-ui/counter";
import RangeSlides from "../uiInterface/advanced-ui/rangeslider";
import Rating from "../uiInterface/advanced-ui/rating";
import Stickynote from "../uiInterface/advanced-ui/stickynote";
import TextEditor from "../uiInterface/advanced-ui/texteditor";
import Scrollbar from "../uiInterface/advanced-ui/uiscrollbar";
import AlertUi from "../uiInterface/base-ui/alert-ui";
import Badges from "../uiInterface/base-ui/badges";
import Borders from "../uiInterface/base-ui/borders";
import Buttons from "../uiInterface/base-ui/buttons";
import ButtonsGroup from "../uiInterface/base-ui/buttonsgroup";
import Cards from "../uiInterface/base-ui/cards";
import Colors from "../uiInterface/base-ui/colors";
import Dropdowns from "../uiInterface/base-ui/dropdowns";
import Images from "../uiInterface/base-ui/images";
import Lightboxes from "../uiInterface/base-ui/lightbox";
import Media from "../uiInterface/base-ui/media";
import Modals from "../uiInterface/base-ui/modals";
import NavTabs from "../uiInterface/base-ui/navtabs";
import Popovers from "../uiInterface/base-ui/popover";
import Toasts from "../uiInterface/base-ui/toasts";
import Tooltips from "../uiInterface/base-ui/tooltips";
import Apexchart from "../uiInterface/charts/apexcharts";
import BasicInputs from "../uiInterface/forms/formelements/basic-inputs";
import CheckboxRadios from "../uiInterface/forms/formelements/checkbox-radios";
import FileUpload from "../uiInterface/forms/formelements/fileupload";
import FormMask from "../uiInterface/forms/formelements/form-mask";
import FormWizard from "../uiInterface/forms/formelements/form-wizard";
import GridGutters from "../uiInterface/forms/formelements/grid-gutters";
import FormHorizontal from "../uiInterface/forms/formelements/layouts/form-horizontal";
import FormSelect2 from "../uiInterface/forms/formelements/layouts/form-select2";
import FormValidation from "../uiInterface/forms/formelements/layouts/form-validation";
import FormVertical from "../uiInterface/forms/formelements/layouts/form-vertical";
import FontawesomeIcons from "../uiInterface/icons/fontawesome";
import IonicIcons from "../uiInterface/icons/ionicicons";
import MaterialIcons from "../uiInterface/icons/materialicon";
import PE7Icons from "../uiInterface/icons/pe7icons";
import ThemifyIcons from "../uiInterface/icons/themify";
import TypiconIcons from "../uiInterface/icons/typicons";
import WeatherIcons from "../uiInterface/icons/weathericons";
import DataTables from "../uiInterface/table/data-tables";
import TablesBasic from "../uiInterface/table/tables-basic";
import DeleteRequest from "../userManagement/deleteRequest";
import Manageusers from "../userManagement/manageusers";
import Permission from "../userManagement/permission";
import RolesPermissions from "../userManagement/rolesPermissions";
import Accordion from "../uiInterface/base-ui/accordion";
import Avatar from "../uiInterface/base-ui/avatar";
import Breadcrumb from "../uiInterface/base-ui/breadcrumb";
import Carousel from "../uiInterface/base-ui/carousel";
import Offcanvas from "../uiInterface/base-ui/offcanvas";
import Pagination from "../uiInterface/base-ui/pagination";
import Progress from "../uiInterface/base-ui/progress";
import Spinner from "../uiInterface/base-ui/spinner";
import Typography from "../uiInterface/base-ui/typography";
import Timeline from "../uiInterface/advanced-ui/timeline";
import InputGroup from "../uiInterface/forms/formelements/input-group";
import FormSelect from "../uiInterface/forms/formelements/form-select";
import Placeholder from "../uiInterface/base-ui/placeholder";
import Alert from "../uiInterface/base-ui/alert";
import Video from "../uiInterface/base-ui/video";
import StudentGrid from "../peoples/students/student-grid/index.tsx";
import BonafideGenerator from "../peoples/students/bonafide/BonafideGenerator";
import Storage from "../settings/otherSettings/storage.tsx";
import TeacherAttendance from "../hrm/attendance/teacher-attendance.tsx";

const routes = all_routes;

export const publicRoutes = [
  {
    path: "/",
    name: "Root",
    element: <Navigate to="/login" />,
    route: Route,
  },
  {
    path: routes.adminDashboard,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.administrativeDashboard,
    element: <AdministrativeDashboard />,
    route: Route,
  },
  {
    path: routes.teacherDashboard,
    element: <TeacherDashboard />,
    route: Route,
  },
  {
    path: routes.studentDashboard,
    element: <StudentDasboard />,
    route: Route,
  },
  {
    path: routes.parentDashboard,
    element: <ParentDashboard />,
    route: Route,
  },
  {
    path: routes.guardianDashboard,
    element: <GuardianDashboard />,
    route: Route,
  },
  {
    path: routes.audioCall,
    element: <AudioCall />,
    route: Route,
  },
  {
    path: routes.callHistory,
    element: <CallHistory />,
    route: Route,
  },
  {
    path: routes.connectedApps,
    element: <ConnectedApps />,
    route: Route,
  },
  {
    path: routes.countries,
    element: <Countries />,
    route: Route,
  },
  {
    path: routes.blankPage,
    element: <BlankPage />,
    route: Route,
  },
  {
    path: routes.calendar,
    element: <Calendar />,
    route: Route,
  },

  {
    path: routes.membershipplan,
    element: <Membershipplan />,
  },
  {
    path: routes.membershipAddon,
    element: <MembershipAddon />,
  },
  {
    path: routes.membershipTransaction,
    element: <MembershipTransaction />,
  },
  {
    path: routes.notes,
    element: <Notes />,
  },
  {
    path: routes.customFields,
    element: <CustomFields />,
    route: Route,
  },
  // {
  //   path: routes.dataTables,
  //   element: <DataTable />,
  //   route: Route,
  // },
  // {
  //   path: routes.tablesBasic,
  //   element: <BasicTable />,
  //   route: Route,
  // },

  {
    path: routes.deleteRequest,
    element: <DeleteRequest />,
    route: Route,
  },
  {
    path: routes.cities,
    element: <Cities />,
    route: Route,
  },

  {
    path: routes.accordion,
    element: <Accordion />,
    route: Route,
  },
  {
    path: routes.avatar,
    element: <Avatar />,
    route: Route,
  },
  {
    path: routes.badges,
    element: <Badges />,
    route: Route,
  },
  {
    path: routes.border,
    element: <Borders />,
    route: Route,
  },
  {
    path: routes.breadcrums,
    element: <Breadcrumb />,
    route: Route,
  },
  {
    path: routes.button,
    element: <Buttons />,
    route: Route,
  },
  {
    path: routes.buttonGroup,
    element: <ButtonsGroup />,
    route: Route,
  },
  {
    path: routes.cards,
    element: <Cards />,
    route: Route,
  },
  {
    path: routes.carousel,
    element: <Carousel />,
    route: Route,
  },
  {
    path: routes.colors,
    element: <Colors />,
    route: Route,
  },
  {
    path: routes.dropdowns,
    element: <Dropdowns />,
    route: Route,
  },
  // {
  //   path: routes.grid,
  //   element: <Grid />,
  //   route: Route,
  // },
  {
    path: routes.images,
    element: <Images />,
    route: Route,
  },
  {
    path: routes.lightbox,
    element: <Lightboxes />,
    route: Route,
  },
  {
    path: routes.media,
    element: <Media />,
    route: Route,
  },
  {
    path: routes.modals,
    element: <Modals />,
    route: Route,
  },
  {
    path: routes.navTabs,
    element: <NavTabs />,
    route: Route,
  },
  {
    path: routes.offcanvas,
    element: <Offcanvas />,
    route: Route,
  },
  {
    path: routes.pagination,
    element: <Pagination />,
    route: Route,
  },
  {
    path: routes.popover,
    element: <Popovers />,
    route: Route,
  },
  {
    path: routes.rangeSlider,
    element: <RangeSlides />,
    route: Route,
  },
  {
    path: routes.progress,
    element: <Progress />,
    route: Route,
  },
  {
    path: routes.spinner,
    element: <Spinner />,
    route: Route,
  },

  {
    path: routes.typography,
    element: <Typography />,
    route: Route,
  },
  {
    path: routes.video,
    element: <Video />,
    route: Route,
  },
  {
    path: routes.toasts,
    element: <Toasts />,
    route: Route,
  },
  {
    path: routes.banIpAddress,
    element: <BanIpAddress />,
    route: Route,
  },
  // {
  //   path: routes.localization,
  //   element: <Localization />,
  //   route: Route,
  // },
  {
    path: routes.preference,
    element: <Preference />,
    route: Route,
  },
  {
    path: routes.todo,
    element: <Todo />,
    route: Route,
  },
  {
    path: routes.email,
    element: <Email />,
    route: Route,
  },
  {
    path: routes.videoCall,
    element: <Videocall />,
    route: Route,
  },
  {
    path: routes.conferenceCall,
    element: <ConferenceCall />,
    route: Route,
  },
  {
    path: routes.chat,
    element: <Chat />,
    route: Route,
  },
  {
    path: routes.pages,
    element: <Pages />,
    route: Route,
  },

  {
    path: routes.fileManager,
    element: <FileManager />,
    route: Route,
  },
  {
    path: routes.faq,
    element: <Faq />,
    route: Route,
  },

  {
    path: routes.states,
    element: <States />,
    route: Route,
  },
  {
    path: routes.testimonials,
    element: <Testimonials />,
    route: Route,
  },
  {
    path: routes.clipboard,
    element: <ClipBoard />,
    route: Route,
  },
  {
    path: routes.counter,
    element: <Counter />,
    route: Route,
  },
  // {
  //   path: routes.dragandDrop,
  //   element: <DragAndDrop />,
  //   route: Route,
  // },
  {
    path: routes.rating,
    element: <Rating />,
    route: Route,
  },
  {
    path: routes.stickyNotes,
    element: <Stickynote />,
    route: Route,
  },
  {
    path: routes.textEditor,
    element: <TextEditor />,
    route: Route,
  },
  {
    path: routes.timeLine,
    element: <Timeline />,
    route: Route,
  },
  {
    path: routes.scrollBar,
    element: <Scrollbar />,
    route: Route,
  },
  {
    path: routes.apexChat,
    element: <Apexchart />,
    route: Route,
  },

  {
    path: routes.fantawesome,
    element: <FontawesomeIcons />,
    route: Route,
  },
  {
    path: routes.materialIcon,
    element: <MaterialIcons />,
    route: Route,
  },
  {
    path: routes.pe7icon,
    element: <PE7Icons />,
    route: Route,
  },

  {
    path: routes.themifyIcon,
    element: <ThemifyIcons />,
    route: Route,
  },
  {
    path: routes.typicon,
    element: <TypiconIcons />,
    route: Route,
  },
  {
    path: routes.basicInput,
    element: <BasicInputs />,
    route: Route,
  },
  {
    path: routes.weatherIcon,
    element: <WeatherIcons />,
    route: Route,
  },
  {
    path: routes.checkboxandRadion,
    element: <CheckboxRadios />,
    route: Route,
  },
  {
    path: routes.inputGroup,
    element: <InputGroup />,
    route: Route,
  },
  {
    path: routes.gridandGutters,
    element: <GridGutters />,
    route: Route,
  },
  {
    path: routes.formSelect,
    element: <FormSelect />,
    route: Route,
  },
  {
    path: routes.formMask,
    element: <FormMask />,
    route: Route,
  },
  {
    path: routes.fileUpload,
    element: <FileUpload />,
    route: Route,
  },
  {
    path: routes.horizontalForm,
    element: <FormHorizontal />,
    route: Route,
  },
  {
    path: routes.verticalForm,
    element: <FormVertical />,
    route: Route,
  },

  {
    path: routes.formValidation,
    element: <FormValidation />,
    route: Route,
  },
  {
    path: routes.reactSelect,
    element: <FormSelect2 />,
    route: Route,
  },
  {
    path: routes.formWizard,
    element: <FormWizard />,
    route: Route,
  },
  {
    path: routes.dataTable,
    element: <DataTables />,
    route: Route,
  },
  {
    path: routes.tableBasic,
    element: <TablesBasic />,
    route: Route,
  },
  {
    path: routes.iconicIcon,
    element: <IonicIcons />,
    route: Route,
  },


  {
    path: routes.placeholder,
    element: <Placeholder />,
    route: Route,
  },
  {
    path: routes.sweetalert,
    element: <Alert />,
    route: Route,
  },
  {
    path: routes.alert,
    element: <AlertUi />,
    route: Route,
  },
  {
    path: routes.tooltip,
    element: <Tooltips />,
    route: Route,
  },
  {
    path: routes.ribbon,
    element: <Ribbon />,
    route: Route,
  },

  // Peoples Module
  {
    path: routes.studentGrid,
    element: <StudentGrid />,
    route: Route,
  },
  {
    path: routes.studentList,
    element: <StudentList />,
    route: Route,
  },
  {
    path: routes.bonafideGenerator,
    element: <BonafideGenerator />,
    route: Route,
  },
  {
    path: routes.addStudent,
    element: <AddStudent />,
    route: Route,
  },
  {
    path: `${routes.editStudent}/:id`,
    element: <AddStudent />,
    route: Route,
  },
  {
    path: routes.studentLibrary,
    element: <StudentLibrary />,
    route: Route,
  },
  {
    path: `${routes.studentDetail}/:id`,
    element: <StudentDetails />,
    route: Route,
  },
  {
    path: routes.studentDetail,
    element: <StudentDetails />,
    route: Route,
  },
  {
    path: routes.studentFees,
    element: <StudentFees />,
    route: Route,
  },
  {
    path: routes.studentLeaves,
    element: <StudentLeaves />,
    route: Route,
  },
  {
    path: routes.studentResult,
    element: <StudentResult />,
    route: Route,
  },
  {
    path: routes.studentTimeTable,
    element: <StudentTimeTable />,
    route: Route,
  },
  {
    path: routes.studentPromotion,
    element: <StudentPromotion />,
    route: Route,
  },
  {
    path: routes.AcademicReason,
    element: <AcademicReason />,
    route: Route,
  },
  {
    path: routes.academicYearNew,
    element: <AcademicYearCreate />,
    route: Route,
  },
  {
    path: routes.academicYearDetail,
    element: <AcademicYearDetail />,
    route: Route,
  },
  {
    path: routes.academicYears,
    element: <AcademicYearsList />,
    route: Route,
  },
  {
    path: routes.classSyllabus,
    element: <ClassSyllabus />,
    route: Route,
  },
  {
    path: routes.classSubject,
    element: <ClassSubject />,
    route: Route,
  },
  {
    path: routes.classSection,
    element: <ClassSection />,
    route: Route,
  },
  {
    path: routes.classRoom,
    element: <ClassRoom />,
    route: Route,

  },
  {
    path: routes.classRoutine,
    element: <ClassRoutine />,
    route: Route,

  },
  {
    path: routes.sheduleClasses,
    element: <ScheduleClasses />,
    route: Route,
  },

  {
    path: routes.exam,
    element: <Exam />,
    route: Route,
  },
  {
    path: routes.examSchedule,
    element: <ExamSchedule />,
    route: Route,

  },
  {
    path: routes.grade,
    element: <Grade />,
    route: Route,
  },
  {
    path: routes.staff,
    element: <Staff />,
    route: Route,
  },
  {
    path: routes.departments,
    element: <Departments />,
    route: Route,
  },
  {
    path: routes.classes,
    element: <Classes />,
    route: Route,
  },
  {
    path: routes.classHomeWork,
    element: <ClassHomeWork />,
    route: Route,
  },
  {
    path: routes.examResult,
    element: <ExamResult />,
    route: Route,
  },
  {
    path: routes.examAttendance,
    element: <ExamAttendance />,
    route: Route,
  },
  {
    path: routes.teacherGrid,
    element: <TeacherGrid />,
    route: Route,
  },
  {
    path: routes.teacherList,
    element: <TeacherList />,
    route: Route,
  },
  {
    path: routes.addTeacher,
    element: <TeacherForm />,
    route: Route,
  },
  {
    path: routes.editTeacher,
    element: <TeacherForm />,
    route: Route,
  },
  {
    path: routes.teacherDetails,
    element: <TeacherDetails />,
    route: Route,
  },
  {
    path: routes.teachersRoutine,
    element: <TeachersRoutine />,
    route: Route,
  },
  {
    path: routes.teacherSalary,
    element: <TeacherSalary />,
    route: Route,
  },
  {
    path: routes.teacherLeaves,
    element: <TeacherLeave />,
    route: Route,
  },
  {
    path: routes.teacherLibrary,
    element: <TeacherLibrary />,
    route: Route,
  },
  {
    path: routes.administrativeDetails,
    element: <AdministrativeDetails />,
    route: Route,
  },
  {
    path: routes.administrativeLeaves,
    element: <AdministrativeLeave />,
    route: Route,
  },
  {
    path: routes.parentGrid,
    element: <ParentGridPage />,
    route: Route,
  },
  {
    path: routes.parentList,
    element: <ParentListPage />,
    route: Route,
  },
  {
    path: routes.classTimetable,
    element: <ClassTimetable />,
    route: Route,
  },
  {
    path: routes.payroll,
    element: <Payroll />,
    route: Route,
  },
  {
    path: routes.holidays,
    element: <Holiday />,
    route: Route,
  },
  {
    path: routes.designation,
    element: <Designation />,
    route: Route,
  },
  {
    path: routes.listLeaves,
    element: <ListLeaves />,
    route: Route,
  },
  {
    path: routes.staffDetails,
    element: <StaffDetails />,
    route: Route,
  },
  {
    path: routes.staffPayroll,
    element: <StaffPayRoll />,
    route: Route,
  },
  {
    path: routes.staffLeave,
    element: <StaffLeave />,
    route: Route,
  },

  {
    path: routes.layoutDefault,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.layoutMini,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.layoutRtl,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.layoutBox,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.layoutDark,
    element: <AdminDashboard />,
    route: Route,
  },
  {
    path: routes.guardiansGrid,
    element: <GuardianGrid />,
    route: Route,
  },
  {
    path: routes.guardiansList,
    element: <GuardianList />,
    route: Route,
  },
  {
    path: routes.feesGroup,
    element: <FeesGroup />,
    route: Route,
  },
  {
    path: routes.feesType,
    element: <FeesTypes />,
    route: Route,
  },
  {
    path: routes.feesMaster,
    element: <FeesMaster />,
    route: Route,
  },
  {
    path: routes.feesAssign,
    element: <FeesAssign />,
    route: Route,
  },
  {
    path: routes.collectFees,
    element: <CollectFees />,
    route: Route,
  },
  {
    path: routes.libraryMembers,
    element: <LibraryMember />,
    route: Route,
  },
  {
    path: routes.libraryBooks,
    element: <Books />,
    route: Route,
  },
  {
    path: routes.libraryIssueBook,
    element: <IssueBook />,
    route: Route,
  },
  {
    path: routes.libraryReturn,
    element: <ReturnBook />,
    route: Route,
  },
  {
    path: routes.sportsList,
    element: <SportsList />,
    route: Route,
  },
  {
    path: routes.playerList,
    element: <PlayersList />,
    route: Route,
  },
  {
    path: routes.hostelRoom,
    element: <HostelRooms />,
    route: Route,
  },
  {
    path: routes.hostelType,
    element: <HostelType />,
    route: Route,
  },
  {
    path: routes.hostelList,
    element: <HostelList />,
    route: Route,
  },
  {
    path: routes.transportRoutes,
    element: <TransportRoutes />,
    route: Route,
  },
  {
    path: routes.transportAssignVehicle,
    element: <TransportAssignVehicle />,
    route: Route,
  },
  {
    path: routes.transportPickupPoints,
    element: <TransportPickupPoints />,
    route: Route,
  },
  {
    path: routes.transportVehicleDrivers,
    element: <TransportVehicleDrivers />,
    route: Route,
  },
  {
    path: routes.transportVehicle,
    element: <TransportVehicle />,
    route: Route,
  },
  {
    path: routes.approveRequest,
    element: <ApproveRequest />,
    route: Route,
  },
  {
    path: routes.studentAttendance,
    element: <StudentAttendance />,
    route: Route,
  },
  {
    path: routes.teacherAttendance,
    element: <TeacherAttendance />,
    route: Route,
  },


  {
    path: routes.staffAttendance,
    element: <StaffAttendance />,
    route: Route,
  },
  {
    path: routes.staffsAttendance,
    element: <StaffsAttendance />,
    route: Route,
  },
  {
    path: routes.addStaff,
    element: <AddStaff />,
    route: Route,
  },
  {
    path: routes.editStaff,
    element: <EditStaff />,
    route: Route,
  },

  {
    path: routes.accountsIncome,
    element: <AccountsIncome />,
    route: Route,
  },
  {
    path: routes.accountsInvoices,
    element: <AccountsInvoices />,
    route: Route,
  },
  {
    path: routes.accountsTransactions,
    element: <AccountsTransactions />,
    route: Route,
  },
  {
    path: routes.addInvoice,
    element: <AddInvoice />,
    route: Route,
  },
  {
    path: routes.editInvoice,
    element: <EditInvoice />,
    route: Route,
  },
  {
    path: routes.guardiansList,
    element: <GuardianList />,
    route: Route,
  },
  {
    path: routes.expense,
    element: <Expense />,
    route: Route,
  },
  {
    path: routes.expenseCategory,
    element: <ExpensesCategory />,
    route: Route,
  },
  {
    path: routes.invoice,
    element: <Invoice />,
    route: Route,
  },
  {
    path: routes.events,
    element: <Events />,
    route: Route,
  },
  {
    path: routes.noticeBoard,
    element: <NoticeBoard />,
    route: Route,
  },

  //Settings

  {
    path: routes.securitysettings,
    element: <Securitysettings />,
    route: Route,
  },
  {
    path: routes.notificationssettings,
    element: <Notificationssettings />,
    route: Route,
  },
  {
    path: routes.connectedApps,
    element: <ConnectedApps />,
    route: Route,
  },
  {
    path: routes.companySettings,
    element: <CompanySettings />,
    route: Route,
  },
  {
    path: routes.localization,
    element: <Localization />,
    route: Route,
  },
  {
    path: routes.prefixes,
    element: <Prefixes />,
    route: Route,
  },
  {
    path: routes.socialAuthentication,
    element: <Socialauthentication />,
    route: Route,
  },
  {
    path: routes.language,
    element: <Languagesettings />,
    route: Route,
  },
  {
    path: routes.invoiceSettings,
    element: <InvoiceSettings />,
    route: Route,
  },
  {
    path: routes.customFields,
    element: <CustomFields />,
    route: Route,
  },
  {
    path: routes.emailSettings,
    element: <EmailSettings />,
    route: Route,
  },
  {
    path: routes.emailTemplates,
    element: <Emailtemplates />,
    route: Route,
  },
  {
    path: routes.smsSettings,
    element: <SmsSettings />,
    route: Route,
  },
  {
    path: routes.optSettings,
    element: <OtpSettings />,
    route: Route,
  },
  {
    path: routes.gdprCookies,
    element: <GdprCookies />,
    route: Route,
  },

  {
    path: routes.paymentGateways,
    element: <PaymentGateways />,
    route: Route,
  },
  {
    path: routes.taxRates,
    element: <TaxRates />,
    route: Route,
  },
  {
    path: routes.schoolSettings,
    element: <SchoolSettings />,
    route: Route,
  },
  {
    path: routes.religion,
    element: <Religion />,
    route: Route,
  },
  {
    path: routes.storage,
    element: <Storage />,
    route: Route,
  },

  {
    path: routes.rolesPermissions,
    element: <RolesPermissions />,
    route: Route,
  },
  {
    path: routes.permissions,
    element: <Permission />,
    route: Route,
  },
  {
    path: routes.manageusers,
    element: <Manageusers />,
    route: Route,
  },
  {
    path: routes.allBlogs,
    element: <AllBlogs />,
    route: Route,
  },
  {
    path: routes.blogCategories,
    element: <BlogCategories />,
    route: Route,
  },
  {
    path: routes.blogComments,
    element: <BlogComments />,
    route: Route,
  },
  {
    path: routes.blogTags,
    element: <BlogTags />,
    route: Route,
  },
  {
    path: routes.tickets,
    element: <Tickets />,
    route: Route,
  },
  {
    path: routes.ticketGrid,
    element: <TicketGrid />,
    route: Route,
  },
  {
    path: routes.ticketDetails,
    element: <TicketDetails />,
    route: Route,
  },
  {
    path: routes.feesReport,
    element: <FeesReport />,
    route: Route,
  },
  {
    path: routes.leaveReport,
    element: <LeaveReport />,
    route: Route,
  },
  {
    path: routes.gradeReport,
    element: <GradeReport />,
    route: Route,
  },
  {
    path: routes.studentReport,
    element: <StudentReport />,
    route: Route,
  },
  {
    path: routes.classReport,
    element: <ClassReport />,
    route: Route,
  },
  {
    path: routes.attendanceReport,
    element: <AttendanceReport />,
    route: Route,
  },
  {
    path: routes.studentAttendanceType,
    element: <StudentAttendanceType />,
    route: Route,
  },
  {
    path: routes.dailyAttendance,
    element: <DailyAttendance />,
    route: Route,
  },
  {
    path: routes.studentDayWise,
    element: <StudentDayWise />,
    route: Route,
  },
  {
    path: routes.teacherDayWise,
    element: <TeacherDayWise />,
    route: Route,
  },
  {
    path: routes.staffDayWise,
    element: <StaffDayWise />,
    route: Route,
  },
  {
    path: routes.teacherReport,
    element: <TeacherReport />,
    route: Route,
  },
  {
    path: routes.staffReport,
    element: <StaffReport />,
    route: Route,
  },
  {
    path: routes.contactMessages,
    element: <ContactMessages />,
    route: Route,
  },
  {
    path: routes.events,
    element: <Events />,
    route: Route,
  },
  {
    path: routes.profile,
    element: <Profile />,
    route: Route,
  },
  {
    path: routes.activity,
    element: <NotificationActivities />,
    route: Route,
  },
];

export const authRoutes = [
  {
    path: routes.comingSoon,
    element: <ComingSoon />,
    route: Route,
  },
  {
    path: routes.login,
    element: <Login />,
    route: Route,
  },
  {
    path: routes.login2,
    element: <Login2 />,
    route: Route,
  },
  {
    path: routes.login3,
    element: <Login3 />,
    route: Route,
  },
  {
    path: routes.register,
    element: <Register />,
    route: Route,
  },
  {
    path: routes.twoStepVerification,
    element: <TwoStepVerification />,
    route: Route,
  },
  {
    path: routes.twoStepVerification2,
    element: <TwoStepVerification2 />,
    route: Route,
  },
  {
    path: routes.twoStepVerification3,
    element: <TwoStepVerification3 />,
    route: Route,
  },
  {
    path: routes.emailVerification,
    element: <EmailVerification />,
    route: Route,
  },
  {
    path: routes.emailVerification2,
    element: <EmailVerification2 />,
    route: Route,
  },
  {
    path: routes.emailVerification3,
    element: <EmailVerification3 />,
    route: Route,
  },
  {
    path: routes.register,
    element: <Register />,
    route: Route,
  },
  {
    path: routes.register2,
    element: <Register2 />,
    route: Route,
  },
  {
    path: routes.register3,
    element: <Register3 />,
    route: Route,
  },
  {
    path: routes.resetPassword,
    element: <ResetPassword />,
    route: Route,
  },
  {
    path: routes.resetPassword2,
    element: <ResetPassword2 />,
    route: Route,
  },
  {
    path: routes.resetPassword3,
    element: <ResetPassword3 />,
    route: Route,
  },
  {
    path: routes.forgotPassword,
    element: <ForgotPassword />,
    route: Route,
  },
  {
    path: routes.forgotPassword2,
    element: <ForgotPassword2 />,
    route: Route,
  },
  {
    path: routes.forgotPassword3,
    element: <ForgotPassword3 />,
    route: Route,
  },
  {
    path: routes.error404,
    element: <Error404 />,
    route: Route,
  },
  {
    path: routes.error500,
    element: <Error500 />,
    route: Route,
  },
  {
    path: routes.underMaintenance,
    element: <UnderMaintenance />,
    route: Route,
  },
  {
    path: routes.lockScreen,
    element: <LockScreen />,
  },
  {
    path: routes.resetPasswordSuccess,
    element: <ResetPasswordSuccess />,
  },
  {
    path: routes.resetPasswordSuccess2,
    element: <ResetPasswordSuccess2 />,
  },
  {
    path: routes.resetPasswordSuccess3,
    element: <ResetPasswordSuccess3 />,
  },
];

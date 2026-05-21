import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';

const defaultImg = 'assets/img/parents/parent-01.jpg';

/** DATE-only values as calendar strings — never parse as Date (avoids TZ off-by-one). */
function formatDateOnlyForDisplay(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '—';
}

export const useTransportDrivers = (queryParams = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState({
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 0
  });

  const fetchDrivers = useCallback(async (overrides = {}) => {
    try {
      setLoading(true);
      setError(null);

      const combinedParams = { ...queryParams, ...overrides };
      const response = await apiService.getTransportDrivers(combinedParams);

      if (response && response.status === "SUCCESS") {
        const list = response.data || [];
        const mapped = await Promise.all(list.map(async (row, index) => ({
          key: row.id || index + 1,
          id: row.id,
          displayId: row.driver_code || String(row.id),
          name: row.name || row.driver_name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'N/A',
          role: row.role
            ? `${String(row.role).charAt(0).toUpperCase()}${String(row.role).slice(1).toLowerCase()}`
            : 'Driver',
          phone: row.phone || 'N/A',
          driverLicenseNo: row.license_number || (row.role === 'conductor' ? 'N/A' : ''),
          licenseExpiry:
            row.role === 'conductor'
              ? '—'
              : formatDateOnlyForDisplay(row.license_expiry),
          licensePhotoUrl: row.license_photo_url || null,
          status: row.is_active ? 'Active' : 'Inactive',
          statusClass: row.is_active ? 'badge badge-soft-success' : 'badge badge-soft-danger',
          img: (row.photo_url ? await apiService.resolveAvatarUrl(row.photo_url) : '') || defaultImg,
          originalData: row,
        })));

        setData(mapped);
        if (response.metadata) {
          setMetadata(response.metadata);
        }
      } else {
        setData([]);
      }
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError(err?.message || 'Failed to fetch drivers');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return {
    data,
    loading,
    error,
    metadata,
    refetch: fetchDrivers,
  };
};

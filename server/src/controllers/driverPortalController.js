const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * Logged-in driver only — data scoped by staff.user_id → drivers.id → vehicles → routes → passengers.
 */
const getMyDriverPortal = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const link = await query(
      `SELECT
          dr.id,
          dr.driver_name,
          dr.employee_code,
          dr.phone,
          dr.email,
          dr.license_number,
          dr.license_expiry,
          dr.address,
          dr.emergency_contact,
          dr.joining_date,
          dr.salary,
          dr.is_active,
          dr.staff_id,
          dr.created_at,
          dr.created_by,
          dr.modified_at,
          s.id AS staff_record_id,
          s.first_name AS staff_first_name,
          s.last_name AS staff_last_name,
          s.employee_code AS staff_employee_code,
          s.phone AS staff_phone,
          s.email AS staff_email
       FROM drivers dr
       INNER JOIN staff s ON s.id = dr.staff_id
       WHERE s.user_id = $1
         AND (s.is_active IS NOT FALSE OR s.is_active IS NULL)
       LIMIT 1`,
      [uid]
    );

    if (link.rows.length === 0) {
      return success(res, 200, 'No driver profile linked to this account', {
        linked: false,
        driver: null,
        staff: null,
        vehicles: [],
        routes: [],
        pickup_points: [],
        passengers: [],
      });
    }

    const row = link.rows[0];
    const driverPk = row.id;

    const vehicles = await query(
      `SELECT * FROM vehicles WHERE driver_id = $1 ORDER BY id ASC`,
      [driverPk]
    );
    const routeIds = [...new Set(vehicles.rows.map((v) => v.route_id).filter((x) => x != null))];

    let routes = [];
    if (routeIds.length > 0) {
      const rt = await query(`SELECT * FROM routes WHERE id = ANY($1::int[]) ORDER BY id ASC`, [routeIds]);
      routes = rt.rows;
    }

    let pickupPoints = [];
    if (routeIds.length > 0) {
      const pp = await query(
        `SELECT * FROM pickup_points
         WHERE route_id = ANY($1::int[])
           AND (is_active IS NOT FALSE OR is_active IS NULL)
         ORDER BY sequence_order NULLS LAST, id ASC`,
        [routeIds]
      );
      pickupPoints = pp.rows;
    }

    let passengers = [];
    if (routeIds.length > 0) {
      const st = await query(
        `SELECT s.id, s.first_name, s.last_name, s.admission_number, s.roll_number,
                s.phone, s.route_id, s.pickup_point_id,
                c.class_name, sec.section_name,
                r.route_name,
                pp.point_name AS pickup_point_name, pp.address AS pickup_address
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         LEFT JOIN routes r ON r.id = s.route_id
         LEFT JOIN pickup_points pp ON pp.id = s.pickup_point_id
         WHERE s.is_active = true
           AND s.is_transport_required = true
           AND s.route_id = ANY($1::int[])
         ORDER BY c.class_name NULLS LAST, sec.section_name NULLS LAST, s.first_name, s.last_name`,
        [routeIds]
      );
      passengers = st.rows;
    }

    const driverPayload = {
      id: row.id,
      driver_name: row.driver_name,
      employee_code: row.employee_code,
      phone: row.phone,
      email: row.email,
      license_number: row.license_number,
      license_expiry: row.license_expiry,
      address: row.address,
      emergency_contact: row.emergency_contact,
      joining_date: row.joining_date,
      salary: row.salary,
      is_active: row.is_active,
      staff_id: row.staff_id,
      created_at: row.created_at,
      created_by: row.created_by,
      modified_at: row.modified_at,
    };

    return success(res, 200, 'Driver portal data', {
      linked: true,
      driver: driverPayload,
      staff: {
        id: row.staff_record_id,
        first_name: row.staff_first_name,
        last_name: row.staff_last_name,
        employee_code: row.staff_employee_code,
        phone: row.staff_phone,
        email: row.staff_email,
      },
      vehicles: vehicles.rows,
      routes,
      pickup_points: pickupPoints,
      passengers,
    });
  } catch (error) {
    console.error('Error in driver portal:', error);
    return errorResponse(res, 500, 'Failed to load driver portal');
  }
};

module.exports = { getMyDriverPortal };

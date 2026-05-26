const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  designationLoginKindFromContext,
  isTeacherDesignationKey,
} = require('../src/utils/staffLoginRoleSync');

describe('staffLoginRoleSync designation rules', () => {
  it('maps Teacher and Demo Teacher to teacher login kind', () => {
    assert.equal(
      designationLoginKindFromContext({ desig_key: 'teacher', dept_key: 'academic' }),
      'teacher'
    );
    assert.equal(
      designationLoginKindFromContext({
        desig_key: 'demo teacher',
        dept_key: 'demo academics department',
      }),
      'teacher'
    );
  });

  it('does not treat Demo Administrative Staff as teacher', () => {
    assert.equal(
      designationLoginKindFromContext({
        desig_key: 'demo administrative staff',
        dept_key: 'demo administration department',
      }),
      'other'
    );
    assert.equal(isTeacherDesignationKey('demo administrative staff'), false);
  });

  it('maps academic department + HOD to teacher', () => {
    assert.equal(
      designationLoginKindFromContext({ desig_key: 'hod', dept_key: 'academic' }),
      'teacher'
    );
  });

  it('maps driver designation', () => {
    assert.equal(
      designationLoginKindFromContext({ desig_key: 'driver', dept_key: 'transport' }),
      'driver'
    );
  });
});

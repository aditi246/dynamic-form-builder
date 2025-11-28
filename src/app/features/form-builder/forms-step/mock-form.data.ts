export const MOCK_FORM_ID = 'form-1764339329627-54l5sb1t9';

export const MOCK_FORM = {
  id: MOCK_FORM_ID,
  name: 'Create Segment',
  createdAt: '2025-11-28T14:15:29.627Z',
  updatedAt: '2025-11-28T17:21:39.373Z',
  fieldCount: 8,
  ruleCount: 9,
  fields: [
    {
      label: 'Compliance Score',
      name: 'comlianceScore',
      type: 'number',
      required: false,
      default: null,
      validation: {},
    },
    {
      label: 'Carpet Area',
      name: 'carpet',
      type: 'number',
      required: false,
      default: null,
      validation: {},
    },
    {
      label: 'Audit Score',
      name: 'auditScore',
      type: 'number',
      required: false,
      default: null,
      validation: {},
    },
    {
      label: 'Category',
      name: 'category',
      type: 'select',
      required: false,
      selectSource: 'manual',
      options: ['Cat 1', 'Cat 2', 'Cat 3'],
      default: '',
      validation: {},
    },
    {
      label: 'Employee Name',
      name: 'employeeName',
      type: 'text',
      required: false,
      default: '',
      validation: { regexType: 'predefined' },
    },
    {
      label: 'Status',
      name: 'status',
      type: 'select',
      required: false,
      selectSource: 'manual',
      options: ['Single', 'Married', 'Divorced'],
      default: '',
      validation: {},
    },
    {
      label: 'Office Location',
      name: 'officeLocation',
      type: 'text',
      required: false,
      default: '',
      validation: { regexType: 'predefined' },
    },
    {
      label: 'Office Employees',
      name: 'officeEmployees',
      type: 'number',
      required: false,
      default: null,
      validation: {},
    },
  ],
  userContext: [
    { key: '1', displayName: 'User Type', value: 'Admin' },
    { key: '2', displayName: 'Location', value: 'India' },
  ],
};

export const MOCK_FORMLIST = [
  {
    ...MOCK_FORM,
  },
];

export const MOCK_RULES = [
  {
    id: 'rule-demmvyu0',
    name: 'Audit Score should be greater than 0',
    conditions: [],
    action: {
      type: 'enforce-comparison',
      targetField: 'comlianceScore',
      comparator: '>',
      valueSource: 'static',
      value: 0,
      errorMessage: 'Compliance Score should be greater than 0',
    },
  },
  {
    id: 'rule-v751fudl',
    name: 'When user type is admin, then employee name should contain adm',
    conditions: [{ field: '1', operator: 'equals', value: 'Admin' }],
    action: {
      type: 'enforce-comparison',
      targetField: 'employeeName',
      comparator: 'contains',
      valueSource: 'static',
      value: 'Adm',
      errorMessage:
        'When user type is admin, then employee name should contain adm',
    },
  },
  {
    id: 'rule-c04xovcg',
    name: "Admin can't be a name",
    conditions: [],
    action: {
      type: 'enforce-comparison',
      targetField: 'employeeName',
      comparator: '!=',
      valueSource: 'static',
      value: 'Admin',
      errorMessage: "Admin can't be a name",
    },
  },
  {
    id: 'rule-2x58s97s',
    name: 'Status cannot be divorced when user is admin and location is India',
    conditions: [
      { field: '2', operator: 'equals', value: 'India' },
      { field: '1', operator: 'equals', value: 'Admin' },
    ],
    action: {
      type: 'enforce-comparison',
      targetField: 'status',
      comparator: '!=',
      valueSource: 'static',
      value: 'Divorced',
      errorMessage:
        'Value must satisfy the rule: status cannot be divorced when user is admin and location is India',
    },
  },
  {
    id: 'rule-lbsooehu',
    name: 'If office location is india, employee should be greater than 30',
    conditions: [
      { field: 'officeLocation', operator: 'equals', value: 'India' },
    ],
    action: {
      type: 'enforce-comparison',
      targetField: 'officeEmployees',
      comparator: '>',
      valueSource: 'static',
      value: 30,
      errorMessage:
        'If office location is india, employee should be greater than 30',
    },
  },
  {
    id: 'rule-svttlvj5',
    name: 'Office location is india, status should not show single',
    conditions: [
      { field: 'officeLocation', operator: 'equals', value: 'India' },
    ],
    action: {
      type: 'enforce-comparison',
      targetField: 'status',
      comparator: 'not-contains',
      valueSource: 'static',
      value: 'Single',
      errorMessage: 'Office location is india, status should not show single',
    },
  },
  {
    id: 'rule-wy4140g4',
    name: 'Office Location is Pakistan, status field should not be visible',
    conditions: [
      { field: 'officeLocation', operator: 'equals', value: 'Pakistan' },
    ],
    action: {
      type: 'hide-field',
      targetField: 'status',
    },
  },
  {
    id: 'rule-r5oe63vs',
    name: 'Audit Score must be greater than ( Compliance score - 10 )',
    conditions: [],
    action: {
      type: 'enforce-comparison',
      targetField: 'auditScore',
      comparator: '>=',
      valueSource: 'field',
      otherField: 'comlianceScore',
      offset: -10,
      errorMessage:
        'Audit Score must be greater than ( Compliance score - 10 )',
    },
  },
  {
    id: 'rule-dzcguzds',
    name: 'Custom rule',
    conditions: [{ field: '1', operator: 'equals', value: 'Admin' }],
    action: {
      type: 'hide-options',
      targetField: 'status',
      options: ['Single'],
    },
  },
];

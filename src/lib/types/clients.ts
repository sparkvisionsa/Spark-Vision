export type TemplateFieldType =
  | "text"
  | "number"
  | "date"
  | "textarea"
  | "email"
  | "tel"
  | "select"
  | "file";

export type FormFieldDef = {
  id: string;
  label: string;
  fieldType: TemplateFieldType;
  /** لنوع «قائمة منسدلة»: النصوص التي يختار منها المستخدم (كل قيمة تُحفظ كما هي) */
  options?: string[];
};

export type FormTemplate = {
  id: string;
  name: string;
  fields: FormFieldDef[];
  createdAt: string;
  updatedAt: string;
};

export type ClientType = {
  id: string;
  name: string;
  createdAt: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  typeId: string;
  address: string;
  clientAddress: string;
  formTemplateId: string | null;
  /** Values for dynamic template fields keyed by field id */
  templateFieldValues: Record<string, string>;
  bankName: string;
  bankAccountAddress: string;
  bankAccountNumber: string;
  createdAt: string;
  updatedAt: string;
};

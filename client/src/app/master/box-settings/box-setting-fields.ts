/**
 * How the master's settings page shows the box's settings. Extensions add groups of their own, see
 * app/extensions/client-extension.ts.
 *
 * A setting's label and hint are the texts boxSettings.fields.<key>.label and .hint
 */
export interface IBoxSettingField {
  key: string;
  // e.g. for the passphrase, which is only shown on request
  isSecret?: boolean;
  options?: IBoxSettingOption[];
  // a list to choose from instead of buttons, for more options than fit in a row
  isSelect?: boolean;
  // only matters with a touch display, so it is hidden without one
  needsTouchDisplay?: boolean;
  // the box reads its value in any case, so the file's is lower-cased to match the options
  isLowerCase?: boolean;
}

export interface IBoxSettingOption {
  value: string;
  // the key of its text, with its parameters
  label: string;
  params?: Record<string, unknown>;
  // for the touch display's size: the factor, written as the language writes numbers when it is shown
  factor?: number;
}

export interface IBoxSettingGroup {
  // the key of its heading
  title: string;
  icon: string;
  fields: IBoxSettingField[];
  // for an extension's group: the title of the group it follows; without one, it goes at the end
  after?: string;
}

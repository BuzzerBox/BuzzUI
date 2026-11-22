import {ANALOG_BUZZERS_SETTING} from '../../../../../shared/extensions/serial-buzzers/analog-buzzers.setting';
import {IClientExtension} from '../client-extension';

/**
 * The client's part of the analog buzzers of the box (server/extensions/serial-buzzers): the ANALOG_BUZZERS setting.
 * Its texts (boxSettings.groups.buzzers, boxSettings.fields.ANALOG_BUZZERS) are still the core's.
 */
export const SERIAL_BUZZERS_CLIENT_EXTENSION: IClientExtension = {
  id: 'serial-buzzers',
  boxSettings: [ANALOG_BUZZERS_SETTING],
  boxSettingGroups: [
    {
      title: 'boxSettings.groups.buzzers', icon: 'radio_button_checked', after: 'boxSettings.groups.wifi', fields: [
        {key: ANALOG_BUZZERS_SETTING.key, isLowerCase: true, options: [
            {value: 'yes', label: 'boxSettings.options.yes'},
            {value: 'no', label: 'boxSettings.options.no'}
          ]}
      ]
    }
  ]
};

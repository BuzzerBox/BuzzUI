import {EProcessArguments, ProcessArgumentsService} from './process-arguments.service';
import config from '../../config.json';
import configDev from '../../config.dev.json';
import { defaultsDeep } from 'lodash';

export class ConfigService {
	private static instance: ConfigService;

	private constructor() {
		// hide public constructor
	}

	private static getInstance(): ConfigService {
		if (this.instance == null) {
			this.instance = new ConfigService()
		}
		return this.instance;
	}

	/**
	 * Get the config dependent on the running mode
	 */
	public static getConfig(): typeof config {
		if (this.getInstance().isDevMode()) {
			return defaultsDeep(configDev, config);
		} else {
			return config;
		}
	}

	/**
	 * An alias for getConfig()
	 * @see getConfig
	 */
	public static get(): typeof config {
		return this.getConfig();
	}

	public isDevMode(): boolean {
		return ProcessArgumentsService.getArgVal(EProcessArguments.ENABLE_DEV_MODE) === '1';
	}

	public static isDevMode(): boolean {
		return this.getInstance().isDevMode();
	}


}

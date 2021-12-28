import {LoggerService} from './logger.service';

enum LogLevel {
	LOG,
	WARN,
	ERROR
}

export class ProcessArgumentsService {
	private static readonly prefixArguments = '--';

	private static instance: ProcessArgumentsService;

	private passedArgumentsMap: Map<EProcessArguments, string>;
	private logQueue: {level: LogLevel, content: object}[] = [];

	private constructor() {
		this.passedArgumentsMap = new Map<EProcessArguments, string>();
		console.log("process.argv", process.argv);
		process.argv.forEach((rawArgToProcess) => {
			this.addLog("Got raw argument for server process:", rawArgToProcess);
			if (rawArgToProcess != null && rawArgToProcess.substr(0, ProcessArgumentsService.prefixArguments.length) === ProcessArgumentsService.prefixArguments) {
				const tmpArg: string = rawArgToProcess.substr(ProcessArgumentsService.prefixArguments.length);
				if (tmpArg.includes('=')) {
					// in this case, the arg passed was something like "--dev=0"
					const split: string[] = tmpArg.split('=');
					const arg: EProcessArguments = EProcessArguments.fromStringRepresentation(split[0]);
					if (arg != null) {
						const value: string = split[1];
						this.passedArgumentsMap.set(arg, value);
						this.addLog(`Found process arg '${arg}' with value '${value}' that is supported`)
					}
				} else {
					// in this case, the arg passed was something like "--dev" which will be interpreted as true since it is explicitly passed
					const arg = EProcessArguments.fromStringRepresentation(tmpArg);
					if (arg != null && EProcessArguments.isArgumentWithoutValueSupported(arg)) {
						this.passedArgumentsMap.set(arg, '1');
					} else {
						this.addWarnLog(`Found process arg ${tmpArg} that is either unknown or needs a value assigned to it!`);
					}
				}
			}
		})
	}

	private static get(): ProcessArgumentsService {
		if (this.instance == null) {
			this.instance = new ProcessArgumentsService()
			this.instance.processLogQueue();
		}
		return this.instance;
	}

	public static getArgVal(arg: EProcessArguments): string {
		return this.get().passedArgumentsMap.get(arg);
	}

	private addLog(...obj): void {
		this.addToLogQueue(LogLevel.LOG, obj);
	}

	private addWarnLog(...obj): void {
		this.addToLogQueue(LogLevel.WARN, obj);
	}

	private addToLogQueue(level: LogLevel, ...obj): void {
		for(const o of obj) {
			this.logQueue.push({level, content: o});
		}
	}

	private processLogQueue(): void {
		while (this.logQueue.length > 0) {
			const entry = this.logQueue.shift();
			switch (entry.level) {
				case LogLevel.WARN:
					LoggerService.warn(entry.content);
					break;
				case LogLevel.ERROR:
					LoggerService.error(entry.content);
					break;
				case LogLevel.LOG:
				default:
					LoggerService.log(entry.content);
					break;
			}
		}
	}
}

// tslint:disable-next-line:max-classes-per-file
export class EProcessArguments {
	static readonly ENABLE_DEV_MODE = new EProcessArguments('dev');

	private readonly stringRepresentation: string;

	private constructor(stringRepresentation: string) {
		this.stringRepresentation = stringRepresentation;
	}

	public static fromStringRepresentation(stringRepresentation: string): EProcessArguments {
		switch (stringRepresentation) {
			case EProcessArguments.ENABLE_DEV_MODE.toString():
				return EProcessArguments.ENABLE_DEV_MODE;
			default:
				return null;
		}
	}

	public toString(): string {
		return this.stringRepresentation;
	}

	public static isArgumentWithoutValueSupported(arg: EProcessArguments): boolean {
		return this.isArgOneOf(arg, [EProcessArguments.ENABLE_DEV_MODE]);
	}

	private static isArgOneOf(arg: EProcessArguments, oneOf: EProcessArguments[]): boolean {
		return oneOf.includes(arg);
	}
}

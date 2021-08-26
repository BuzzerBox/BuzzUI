import {ByteHelper} from '../helper/byte.helper';

export class Byte {
    private readonly value: number;

    public constructor(value: string | number) {
        if (typeof value === 'string') {
            if (isNaN(Number(value))) {
                // In this case, it is a string that can't be converted to a number
                throw Error(`The value >${value}< can't be converted to a number`);
            } else {
                const x: number = parseInt(value);
                ByteHelper.assureByte(x);
                this.value = x;
            }
        } else {
            ByteHelper.assureByte(value);
            this.value = value;
        }
    }

    public getValue(): number {
        return this.value;
    }

    public static from(origin: number[]): Byte[] {
        const result: Byte[] = [];
        for (const n of origin) {
            result.push(new Byte(n));
        }
        return result;
    }
}

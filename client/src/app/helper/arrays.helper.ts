export class ArraysHelper {
  private constructor() {
  }

  public static  removeMultiple<T = any>(array: Array<T>, objects: T[]): void {
    for (const obj of objects) {
      this.remove<T>(array, obj);
    }
  }

  public static remove<T = any>(array: Array<T>, obj: T): void {
    for (let i = 0; i < array.length; i++) {
      if (array[i] === obj) {
        array.splice(i, 1);
      }
    }
  }
}

export interface IDirectoryTree {
    path: string;
    name: string;
    size: number;
    type: "directory" | "file";
    children ? : IDirectoryTree[];
    extension?: string;
    isSymbolicLink?: boolean;
}

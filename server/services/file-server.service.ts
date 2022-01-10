import {MainExpressService} from "./main-express.service";
import express from "express";
import dirTree from "directory-tree";
import {IDirectoryTree} from "../../shared/shared";
import cors from "cors";
import {FileExtensionsService} from "../../shared/shared";

export class FileServerService {
    private static instance: FileServerService;
    // initialize a static, express file server
    private isStarted: boolean;

    private constructor() {
        this.isStarted = false;
    }

    public static get(): FileServerService {
        if (this.instance == null) {
            this.instance = new FileServerService();
        }
        return this.instance;
    }


    public start(port: number, localPath: string, serverPath: string = '/media'): void {
        // start our server
        if (!this.isStarted) {
            MainExpressService.get().getMain().use(cors());
            MainExpressService.get().getMain().use(serverPath, express.static(localPath)).listen(port, () => {
                console.log(`Fileserver started on port ${port}!`);
            })
            MainExpressService.get().getMain().get(serverPath, (req, res) => {
                const tree = dirTree(localPath, {attributes:['extension', 'size', 'type'], normalizePath: true});
                console.log(tree.children.length);
                return res.json(this.cleanPath(tree, localPath));
            })
            this.isStarted = true;
        }
    }

    // This is an ugly hack.
    private cleanPath(tree: IDirectoryTree, localPath): IDirectoryTree {
        if(tree.path) {
            tree.path = tree.path.replace(localPath, "");
        }
        const children = [];
        if (tree.children && tree.children.length > 0) {
            for (const child of tree.children) {
                const subtree = this.cleanPath(child, localPath);
                if (subtree) {
                    children.push(subtree);
                }
            }
            tree.children = children;
            if (tree.children.every(el => el === undefined)) {
                return undefined;
            }
            return tree;
        } else if (tree.children && tree.children.length === 0) {
            return undefined;
        } else if (tree.type === 'file') {
            if (FileExtensionsService.getExtensions().includes(tree.extension)) {
                return tree;
            } else {
                return undefined;
            }
        }
        return tree;
    }
}

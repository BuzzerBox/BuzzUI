import {MainExpressService} from "./main-express.service";
import express, {NextFunction, Request, Response} from "express";
import path from "path";
import dirTree from "directory-tree";
import {IDirectoryTree} from "../../shared/shared";
import {FileExtensionsService, StorageApiHelper} from "../../shared/shared";
import {StorageApiService} from "./storage-api.service";
import {StorageService} from "./storage.service";

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
            const main = MainExpressService.get().getMain();
            main.use(StorageApiHelper.BASE_PATH, StorageApiService.get().makeRouter());
            // the box's games are a folder next to the USB sticks
            main.use(serverPath + '/' + StorageApiHelper.BOX_MEDIA_FOLDER, this.onlyMedia, express.static(StorageService.get().getBoxGamesPath()));
            main.use(serverPath, this.onlyMedia, express.static(localPath)).listen(port, () => {
                console.log(`Fileserver started on port ${port}!`);
            })
            main.get(serverPath, (req, res) => {
                const tree = dirTree(localPath, {attributes:['extension', 'size', 'type'], normalizePath: true});
                if (tree === null) {
                    return res.status(404).json({ error: `Media path not found: ${localPath}` });
                }
                return res.json(this.cleanPath(tree, localPath));
            })
            this.isStarted = true;
        }
    }

    /**
     * Only media are served, not the versions and states of the games next to them, which hold the answers
     */
    private onlyMedia(req: Request, res: Response, next: NextFunction): void {
        let requestedPath: string;
        try {
            requestedPath = decodeURIComponent(req.path);
        } catch (e) {
            requestedPath = '';
        }
        const isRoot = requestedPath === '/' || requestedPath === '';
        if (isRoot || (!requestedPath.split('/').includes('..') && FileExtensionsService.isSupportedExtension(path.extname(requestedPath)))) {
            next();
        } else {
            res.status(404).end();
        }
    }

    // This is an ugly hack.
    private cleanPath(tree: IDirectoryTree, localPath): IDirectoryTree {
        const normalizedLocalPath = localPath.replace(/^\.\//, '');
        if(tree.path) {
            tree.path = tree.path.replace(normalizedLocalPath, "");
        }
        const children = [];
        if (tree.children && tree.children.length > 0) {
            for (const child of tree.children) {
                const subtree = this.cleanPath(child, normalizedLocalPath);
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
            if (FileExtensionsService.isSupportedExtension(tree.extension)) {
                return tree;
            } else {
                return undefined;
            }
        }
        return tree;
    }
}

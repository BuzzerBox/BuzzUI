import express, {NextFunction, Request, RequestHandler, Response, Router} from 'express';
import {pipeline} from 'stream';
import {StorageApiHelper} from '../../shared/shared';
import {StorageError, StorageService} from './storage.service';
import {LoggerService} from './logger.service';

/**
 * The HTTP routes of the storage API, see StorageApiHelper. Only the master may use them, which the token it got when
 * registering proves.
 */
export class StorageApiService {
    private static instance: StorageApiService;
    private readonly storage = StorageService.get();
    // the download of a game's archive, see makeRouter; names can't contain "/"
    private static readonly ARCHIVE_ROUTE = /^\/locations\/[^/]+\/games\/[^/]+\/archive$/;

    private constructor() {
    }

    public static get(): StorageApiService {
        if (this.instance == null) {
            this.instance = new StorageApiService();
        }
        return this.instance;
    }

    public makeRouter(): Router {
        const router = express.Router();
        router.use(this.checkAccessToken.bind(this));
        router.get('/locations', this.handle(async (req, res) => {
            res.json(await this.storage.getLocations());
        }));
        const jsonBody = express.json({limit: StorageService.getMaxJsonSize()});
        const game = '/locations/:location/games/:game';

        router.get('/locations/:location/games', this.handle(async (req, res) => {
            res.json(await this.storage.listGames(req.params.location));
        }));
        router.post(game, this.handle(async (req, res) => {
            res.status(201).json(await this.storage.createGame(req.params.location, req.params.game));
        }));
        router.delete(game, this.handle(async (req, res) => {
            await this.storage.deleteGame(req.params.location, req.params.game);
            res.status(204).end();
        }));
        router.post(game + '/archive-ticket', this.handle(async (req, res) => {
            res.status(201).json({ticket: this.storage.issueDownloadTicket(req.params.location, req.params.game)});
        }));
        router.get(game + '/archive', this.handle(async (req, res) => {
            const ticket = req.query[StorageApiHelper.DOWNLOAD_TICKET_QUERY_PARAMETER];
            if (!this.hasValidToken(req) && !this.storage.redeemDownloadTicket(ticket, req.params.location, req.params.game)) {
                res.status(401).json({error: 'This download link is no longer valid, start the download again'});
                return;
            }
            const archive = await this.storage.createGameArchive(req.params.location, req.params.game);
            const fileName = req.params.game + StorageApiHelper.GAME_ARCHIVE_EXTENSION;
            res.setHeader('Content-Type', 'application/gzip');
            // the ASCII name for old browsers, the real one for the others
            res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^\x20-\x7e]|"/g, '_')}"; `
                + `filename*=UTF-8''${encodeURIComponent(fileName)}`);
            // unlike pipe, pipeline also ends the archive, with its open files, when the download is cancelled
            pipeline(archive, res, e => {
                if (e != null && !res.writableFinished) {
                    LoggerService.warn(`The archive of ${req.params.game} was not sent completely`, e);
                }
            });
        }));
        router.post(game + '/copy', jsonBody, this.handle(async (req, res) => {
            res.status(201).json(await this.storage.copyGame(req.params.location, req.params.game, req.body));
        }));

        router.get(game + '/versions/:version', this.handle(async (req, res) => {
            res.json(await this.storage.getVersion(req.params.location, req.params.game, req.params.version));
        }));
        router.post(game + '/versions', jsonBody, this.handle(async (req, res) => {
            res.status(201).json(await this.storage.saveVersion(req.params.location, req.params.game, req.body));
        }));
        router.delete(game + '/versions/:version', this.handle(async (req, res) => {
            await this.storage.deleteVersion(req.params.location, req.params.game, req.params.version);
            res.status(204).end();
        }));

        router.get(game + '/states/:state', this.handle(async (req, res) => {
            res.json(await this.storage.getState(req.params.location, req.params.game, req.params.state));
        }));
        router.post(game + '/states/:state/rename', jsonBody, this.handle(async (req, res) => {
            await this.storage.renameState(req.params.location, req.params.game, req.params.state, req.body?.name);
            res.status(204).end();
        }));
        router.delete(game + '/states/:state', this.handle(async (req, res) => {
            await this.storage.deleteState(req.params.location, req.params.game, req.params.state);
            res.status(204).end();
        }));

        router.get(game + '/media-tree', this.handle(async (req, res) => {
            res.json(await this.storage.getGameMediaTree(req.params.location, req.params.game));
        }));
        router.get(game + '/media', this.handle(async (req, res) => {
            res.json(await this.storage.listGameMedia(req.params.location, req.params.game, this.getPath(req)));
        }));
        // the body is the file itself, streamed to the disk since videos can be large
        router.put(game + '/media', this.handle(async (req, res) => {
            const contentLength = req.headers['content-length'] != null ? Number(req.headers['content-length']) : undefined;
            res.status(201).json(await this.storage.uploadGameMedia(req.params.location, req.params.game, this.getPath(req), req,
                this.isOverwrite(req), contentLength));
        }));
        router.post(game + '/folders', this.handle(async (req, res) => {
            res.status(201).json(await this.storage.createGameMediaFolder(req.params.location, req.params.game, this.getPath(req)));
        }));
        router.delete(game + '/media', this.handle(async (req, res) => {
            await this.storage.deleteGameMedia(req.params.location, req.params.game, this.getPath(req));
            res.status(204).end();
        }));
        router.post(game + '/media/move', jsonBody, this.handle(async (req, res) => {
            res.json(await this.storage.moveGameMedia(req.params.location, req.params.game, this.getPath(req), req.body?.toPath));
        }));
        router.post(game + '/media/copy', jsonBody, this.handle(async (req, res) => {
            res.status(201).json(await this.storage.copyIntoGame(req.params.location, req.params.game, this.getPath(req),
                req.body?.fromLocation, req.body?.fromPath));
        }));

        router.get('/locations/:location/media', this.handle(async (req, res) => {
            res.json(await this.storage.listStickMedia(req.params.location, this.getPath(req)));
        }));
        // the body is the archive itself, streamed since it holds the game's media
        router.post('/locations/:location/import-archive', this.handle(async (req, res) => {
            const name = typeof req.query.name === 'string' ? req.query.name : '';
            const contentLength = req.headers['content-length'] != null ? Number(req.headers['content-length']) : undefined;
            res.status(201).json(await this.storage.importGameArchive(req.params.location, name, req, contentLength));
        }));
        router.post('/locations/:location/import', jsonBody, this.handle(async (req, res) => {
            const name = typeof req.query.name === 'string' ? req.query.name : '';
            res.status(201).json(await this.storage.importBundle(req.params.location, name, req.body));
        }));
        return router;
    }

    private hasValidToken(req: Request): boolean {
        return this.storage.isValidAccessToken(req.get(StorageApiHelper.TOKEN_HEADER));
    }

    private checkAccessToken(req: Request, res: Response, next: NextFunction): void {
        // a download through the browser can't send the header; its route checks the download ticket instead. Only
        // that route: a state named "archive" ends in /archive as well.
        const isDownload = req.method === 'GET' && StorageApiService.ARCHIVE_ROUTE.test(req.path);
        if (isDownload || this.hasValidToken(req)) {
            next();
        } else {
            res.status(401).json({error: 'Only the game master may access the storage'});
        }
    }

    private getPath(req: Request): string {
        const path = req.query.path;
        return typeof path === 'string' ? path : '';
    }

    private isOverwrite(req: Request): boolean {
        return req.query.overwrite === 'true';
    }

    /**
     * Express 4 doesn't catch the errors of async handlers, so this answers them
     */
    private handle(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
        return (req, res) => {
            handler(req, res).catch(e => {
                const status = e instanceof StorageError ? e.status : 500;
                if (!(e instanceof StorageError)) {
                    LoggerService.error(`Storage request ${req.method} ${req.originalUrl} failed`, e);
                }
                if (res.headersSent) {
                    res.end();
                    return;
                }
                // the rest of an upload that was refused isn't of interest
                req.resume();
                res.status(status).json({error: e instanceof StorageError ? e.message : 'Internal error'});
            });
        };
    }
}

import "reflect-metadata";
import {RESTClient, GET, POST, FormBody, UrlReplacements, up} from './DecoratorRestClient';


export type TorrentStatus = "magnet_error" | "magnet_conversion" | "waiting_files_selection" |
    "queued" | "downloading" | "downloaded" | "error" | "virus" | "compressing" | "uploading" | "dead";

export interface Torrent {
    id: string;
    filename: string;
    hash: string;
    bytes: number;
    host: string;
    split: number;
    progress: number; // Possible values: 0 to 100
    status: TorrentStatus;
    added: string; //json date
    links: string[];
    ended?: string; //json date
    speed?: number;
    seeders?: number;
}
export interface SingleTorrent extends Torrent {
    original_filename: string;
    original_bytes: number;
    files: {
        id: number;
        path: string;
        bytes: number;
        selected: number; // can be 0 or 1
    }[];
}

export class RealDebridRestClient extends RESTClient {
    constructor(private accessToken: string) {
        super({ baseURL: "https://api.real-debrid.com/rest/1.0" });
    }
    requestInterceptor(req: Axios.AxiosXHRConfig<any>) {
        req.headers = Object.assign({}, req.headers, { "Authorization": `Bearer ${this.accessToken}` });
        return req;
    }
    @GET("/user")
    public user(): Promise<{
        id: number,
        username: string,
        email: string,
        points: number, // Fidelity points
        locale: string, // User language
        avatar: string, // URL
        type: string, // "premium" or "free"
        premium: number, // seconds left as a Premium user
        expiration: string // jsonDate
    }>
    { throw up }

    @POST("/unrestrict/link")
    public unrestrictLink(
        @FormBody args: {
            link: string;
            password?: string;
            remote?: "1" | "0";
        }): Promise<{
            id: string;
            filename: string;
            mimeType: string;
            filesize: number;
            link: string;
            host: string;
            chunks: number;
            crc: number;
            download: string;
            streamable: number;
        }>
    { throw up }

    @POST("/torrents/addMagnet")
    public torrentsAddMagnet(
        @FormBody args: {
            magnet: string;
            host?: string;
            split?: number;
        }): Promise<{
            id: string;
            uri: string;
        }>
    { throw up }

    @POST(({id}) => `/torrents/selectFiles/${id}`)
    public torrentsSelectFiles(
        @UrlReplacements args: { id: string },
        @FormBody data: {
            /** Selected files IDs (comma separated) or "all"*/
            files: string;
        }): Promise<void>
    { throw up }

    @GET(({id}) => `/torrents/info/${id}`)
    public torrentsInfo( @UrlReplacements args: { id: string }): Promise<SingleTorrent> { throw up }

    public async magnetLinkToURL(magnetLink: string, progressUpdate: (message: string) => void) {
        const magnet = await this.torrentsAddMagnet({ magnet: magnetLink, host: 'uptobox.com' });
        progressUpdate("added magnet link");
        await this.torrentsSelectFiles(magnet, { files: "all" });
        let infos = { status: 'wait', progress: 0, links: [] as string[] };
        progressUpdate(`Convert torrent progress: ${infos.status}: ${infos.progress}%`);
        while (!infos.links || infos.links.length == 0) {
            infos = await this.torrentsInfo(magnet);
            progressUpdate(`Convert torrent progress: ${infos.status}: ${infos.progress}%`);
            if (infos.status === 'error') throw Error('Error: convert failed');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (infos.links.length > 1)
            throw Error(`Cannot download split files : \n${infos.links.join('\n')}`);

        return infos.links[0];
    }
}

const token = process.env.RD_TOKEN;
if(!token) {
    console.error("set the environment variable RD_TOKEN to the token from https://real-debrid.com/apitoken");
    process.exit(1);
}
const link = process.argv[2];
if(!link || !link.match(/^magnet:.+/)) {
    console.error("usage: rdclient [magnet link]");
    process.exit(1);
}
const rd = new RealDebridRestClient(token);
rd.magnetLinkToURL(link, progress => console.error(progress))
    .then(link => rd.unrestrictLink({ link }))
    .then(res => console.log(res.download))
    .catch(e => console.error("failed:", e));

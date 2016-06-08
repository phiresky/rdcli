import * as axios from 'axios';
import * as querystring from 'querystring';

const bodyRetrieverSymbol: Symbol = Symbol("body");
const urlReplacementsSymbol: Symbol = Symbol("urlreplacements");
export abstract class RESTClient {
    constructor(public readonly config: { baseURL: string }) {

    }
    abstract requestInterceptor(req: Axios.AxiosXHRConfig<any>): Axios.AxiosXHRConfig<any>;
}
export function RemoteMethod(method: string, urlTemplate: string | ((urlArgs: any) => string)): MethodDecorator {
    return (target: RESTClient, methodName: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) => {
        const bodyRetriever = Reflect.getOwnMetadata(bodyRetrieverSymbol, target, methodName);
        const urlReplacements = Reflect.getOwnMetadata(urlReplacementsSymbol, target, methodName);
        descriptor.value = function (this: RESTClient, ...args: any[]) {
            const url = (this.config.baseURL +
                            (typeof urlTemplate == 'function' ? urlTemplate(urlReplacements(args)) : urlTemplate));
            let body: any = undefined;
            if (bodyRetriever !== undefined) {
                body = bodyRetriever(args);
            }
            let req: Axios.AxiosXHRConfig<any> = { url, method, data: body, responseType: "json" };
            req = this.requestInterceptor(req);
            return axios(this.requestInterceptor(req)).then(resp => resp.data)
                .catch(rej => Promise.reject(rej.data)) as Promise<any>;
        }
    };
}
export function GET(urlTemplate: string | ((urlArgs: any) => string)): MethodDecorator {
    return RemoteMethod('get', urlTemplate);
}
export function POST(urlTemplate: string | ((urlArgs: any) => string)): MethodDecorator {
    return RemoteMethod('post', urlTemplate);
}
function SetMetadata(symbol: Symbol, mapper: (argument: any) => any) {
    return (target: RESTClient, methodName: string, parameterIndex: number) => {
        if (Reflect.hasOwnMetadata(symbol, target, methodName))
            throw Error("cannot define Body multiple times");
        Reflect.defineMetadata(symbol, (args: any[]) => mapper(args[parameterIndex]), target, methodName);
    }
}
export const FormBody = SetMetadata(bodyRetrieverSymbol, body => querystring.stringify(body));
export const JSONBody = SetMetadata(bodyRetrieverSymbol, body => JSON.stringify(body));
export const UrlReplacements = SetMetadata(urlReplacementsSymbol, args => args);
/** throw up to indicate the method will be replaced at runtime */
export const up = "This method should be replaced by the decorators";
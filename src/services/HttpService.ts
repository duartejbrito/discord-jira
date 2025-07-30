import fetch, {
  RequestInit as NodeFetchRequestInit,
  Response as NodeFetchResponse,
} from "node-fetch";

/* eslint-disable no-unused-vars */
export interface IHttpService {
  fetch(
    url: string,
    options?: NodeFetchRequestInit
  ): Promise<NodeFetchResponse>;
}
/* eslint-enable no-unused-vars */

export class HttpService implements IHttpService {
  private static instance: IHttpService;

  static getInstance(): IHttpService {
    if (!HttpService.instance) {
      HttpService.instance = new HttpService();
    }
    return HttpService.instance;
  }

  async fetch(
    url: string,
    options?: NodeFetchRequestInit
  ): Promise<NodeFetchResponse> {
    return fetch(url, options);
  }
}

// Export singleton instance for backward compatibility
export const httpService = HttpService.getInstance();

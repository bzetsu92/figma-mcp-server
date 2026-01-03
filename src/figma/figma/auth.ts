import type { FigmaAuthOptions } from "./interfaces";

export class FigmaAuth {
    private readonly apiKey: string;
    private readonly oauthToken: string;
    private readonly useOAuth: boolean;

    constructor(options: FigmaAuthOptions) {
        this.apiKey = options.figmaApiKey ?? "";
        this.oauthToken = options.figmaOAuthToken ?? "";
        this.useOAuth = options.useOAuth && this.oauthToken.length > 0;
    }

    getHeaders(): Record<string, string> {
        if (this.useOAuth) {
            return { Authorization: `Bearer ${this.oauthToken}` };
        }
        return { "X-Figma-Token": this.apiKey };
    }

    isOAuth(): boolean {
        return this.useOAuth;
    }

    hasValidAuth(): boolean {
        return this.useOAuth ? this.oauthToken.length > 0 : this.apiKey.length > 0;
    }
}


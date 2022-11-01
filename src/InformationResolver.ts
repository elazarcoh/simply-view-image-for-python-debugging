import { ViewerService } from "./ViewerService";

export interface Information {
    service: ViewerService;
    details: Record<string, string>;
}

export class InformationResolver {
    constructor(
        private readonly _services: ViewerService[]
    ) { }

    async resolveExpression(expression: string): Promise<Information> {
        return {
            service: this._services[0],
            details: {
                type: "np.ndarray",
            }
        }
    }

    async resolveVariable(variable: string): Promise<Information> {
        return {
            service: this._services[0],
            details: {
                type: "np.ndarray",
            }
        }
    }
}

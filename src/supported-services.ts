import { ViewerService } from "./ViewerService";
import ViewImageService from "./ViewImageService";
import ViewPlotService from "./ViewPlotService";
import ViewTensorService from "./ViewTensorService";

export enum ObjectTypeGroup {
    Image = "image",
    Plot = "plot",
    Tensor = "tensor",
}

export type SupportedServicesNames = "image" | "plot" | "tensor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SUPPORTED_SERVICES: [SupportedServicesNames, new (_: any) => ViewerService][] = [
    ["image", ViewImageService],
    ["plot", ViewPlotService],
    ["tensor", ViewTensorService]
]

export default SUPPORTED_SERVICES;
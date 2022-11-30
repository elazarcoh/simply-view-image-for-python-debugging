import PILLOW_CODE from "../python/image_pillow.py?raw";
import NUMPY_CODE from "../python/image_numpy.py?raw";
import { Viewable } from "./Viewable";
import { ViewableRegistry } from "../ViewableRegistry";
import Container from "typedi";

const NumpyImage: Viewable = {
    group: "image",
    type: "numpy_image",
    setupPythonCode: () => NUMPY_CODE,
}
Container.get(ViewableRegistry).registerViewable(NumpyImage);

const PillowImage: Viewable = {
    group: "image",
    type: "pillow_image",
    setupPythonCode: () => PILLOW_CODE,
}
Container.get(ViewableRegistry).registerViewable(PillowImage);

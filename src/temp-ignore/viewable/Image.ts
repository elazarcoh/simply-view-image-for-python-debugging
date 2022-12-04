import PILLOW_CODE from "../python/image_pillow.py?raw";
import NUMPY_CODE from "../python/image_numpy.py?raw";
import { Viewable } from "./Viewable";
import { ViewableRegistry } from "../ViewableRegistry";
import Container from "typedi";

const NumpyImage: Viewable = {
    group: "image",
    type: "numpy_image",
    setupPythonCode: () => ({
        setupCode: NUMPY_CODE,
        testSetupCode: "(is_numpy_image, numpy_image_info, numpy_image_save)"  // require all three functions to be defined
    })
}
Container.get(ViewableRegistry).addViewable(NumpyImage);

const PillowImage: Viewable = {
    group: "image",
    type: "pillow_image",
    setupPythonCode: () => ({
        setupCode: PILLOW_CODE,
        testSetupCode: "(is_pillow_image, pillow_image_info, pillow_image_save)"  // require all three functions to be defined
    })
}
Container.get(ViewableRegistry).addViewable(PillowImage);

import {
    VSCodeDropdown,
    VSCodeOption,
    VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
import ImageView from "./ImageView";
import "./SelectableImage.css";

interface ImagePlaceholderProps {
    placeholderText: string;
}

const ImagePlaceholder = ({ placeholderText }: ImagePlaceholderProps) => {
    return (
        <div className="svifpd-image-placeholder">
            <div className="svifpd-image-placeholder__text">
                {placeholderText}
            </div>
        </div>
    );
};

interface ImageFrameProps {
    isLoading: boolean;
    imageData: ImageData | null;
}
const ImageFrame = ({ imageData, isLoading }: ImageFrameProps) => {
    if (imageData === null) {
        return <ImagePlaceholder placeholderText="No image selected" />;
    } else if (isLoading) {
        return <VSCodeProgressRing />;
    } else {
        return (
            <div className="svifpd-image-frame">
                <ImageView imageData={imageData} />
            </div>
        );
    }
};

interface SelectableImageProps {
    names: string[];
    imageDataByName: (name: string) => Promise<ImageData>;
}

const SelectableImage = (props: SelectableImageProps) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageData, setImageData] = useState<ImageData | null>(null);

    const handleMenuItemClick = async (name: string) => {
        setImageData(null);
        // sleep to emulate async image loading
        // FIXME: remove this when we have a real async image loading function
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSelectedImage(name);
        const data = await props.imageDataByName(name);
        setImageData(data);
    };

    return (
        <div className="svifpd-selectable-image">
            <VSCodeDropdown
                onChange={(e) =>
                    e.target !== null
                        ? handleMenuItemClick(
                              (e.target as HTMLInputElement).value
                          )
                        : null
                }
            >
                {props.names.map((name, index) => (
                    <VSCodeOption key={`${index}-${name}`} value={name}>
                        {name}
                    </VSCodeOption>
                ))}
            </VSCodeDropdown>
            <div className="svifpd-selectable-image__image">
                {selectedImage !== null ? (
                    <ImageFrame
                        imageData={imageData}
                        isLoading={imageData === null}
                    />
                ) : (
                    <ImagePlaceholder placeholderText="No image selected" />
                )}
            </div>
        </div>
    );
};

export default SelectableImage;

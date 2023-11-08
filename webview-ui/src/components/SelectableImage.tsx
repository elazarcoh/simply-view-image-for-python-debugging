import {
    VSCodeDropdown,
    VSCodeOption,
    VSCodeProgressRing,
} from "@vscode/webview-ui-toolkit/react";
import { useState } from "react";
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
    imageData: Base64<string> | null;
}

const ImageFrame = ({ imageData, isLoading }: ImageFrameProps) => {
    return (
        <div className="svifpd-image-frame">
            {isLoading || imageData === null ? (
                <VSCodeProgressRing />
            ) : (
                <img src={imageData} alt="Selected image" />
            )}
        </div>
    );
};

interface SelectableImageProps {
    names: string[];
    imageDataBase64ByName: (name: string) => Promise<Base64<string>>;
}

const SelectableImage = (props: SelectableImageProps) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageData, setImageData] = useState<Base64<string> | null>(null);

    const handleMenuItemClick = async (name: string) => {
        setImageData(null);
        // sleep to emulate async image loading
        // FIXME: remove this when we have a real async image loading function
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSelectedImage(name);
        const data = await props.imageDataBase64ByName(name);
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
                    <ImageFrame imageData={imageData} isLoading={imageData === null} />
                ) : (
                    <ImagePlaceholder placeholderText="No image selected" />
                )}
            </div>
        </div>
    );
};

export default SelectableImage;

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./RadioButtonGroup.css";

interface RadioButtonGroupProps {
    defaultValue?: string;
    onChange?: (value: string) => void;
}

function RadioButtonGroup({
    defaultValue,
    onChange,
    children,
}: React.PropsWithChildren<RadioButtonGroupProps>): JSX.Element {
    const [selected, setSelected] = useState<string | null>(
        defaultValue ?? null
    );

    let prevSelected = selected;
    const handleClick = (value: string) => {
        setSelected(value);
        if (prevSelected !== value && onChange !== undefined) {
            onChange(value);
            prevSelected = value;
        }
    };

    useEffect(() => {
        if (defaultValue !== undefined) {
            setSelected(defaultValue);
        }
    }, [defaultValue]);

    const className = (option: string) => {
        return `vscode-button ${
            option === selected ? "selected" : "unselected"
        }`;
    };

    return (
        <div className="svifpd-radio-button-group">
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, {
                        ...child.props,
                        className: className(child.props.value),
                        onClick: () => handleClick(child.props.value),
                    });
                }
                return child;
            })}
        </div>
    );
}

RadioButtonGroup.defaultProps = {
    options: [],
    onChange: undefined,
};

RadioButtonGroup.propTypes = {
    options: PropTypes.arrayOf(PropTypes.string),
    defaultValue: PropTypes.string,
    onChange: PropTypes.func,
};

export default RadioButtonGroup;

import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import "./RadioButtonGroup.css";

interface RadioButtonGroupProps {
    options: string[];
    defaultValue?: string;
    onChange?: (value: string) => void;
}

function RadioButtonGroup({
    options,
    defaultValue,
    onChange,
}: RadioButtonGroupProps): JSX.Element {
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
        return `svifpd-radio-button ${selected === option ? "selected" : ""}`;
    };

    return (
        <div className="svifpd-radio-button-group">
            {options.map((option) => (
                <button
                    className={className(option)}
                    key={option}
                    onClick={() => handleClick(option)}
                >
                    {option}
                </button>
            ))}
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

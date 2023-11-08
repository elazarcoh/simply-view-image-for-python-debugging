import { forwardRef } from "react";

const CodeTextArea = forwardRef<HTMLTextAreaElement>((props, ref) => {
    return (
        <div>
            <textarea {...props} ref={ref} />
        </div>
    );
});

export default CodeTextArea;

/** Usage example:
 *
 * import CodeTextArea from "./CodeTextArea";
 *
 * {
 *   const ref = useRef<HTMLTextAreaElement>(null);
 *   useEffect(() => {
 *       const handleKeyPressEvent = (e: KeyboardEvent) => {
 *           const hasCtrl = e.ctrlKey;
 *           // const hasAlt = e.altKey;
 *           const hasShift = e.shiftKey;
 *           const key = e.key;
 *           if ((hasShift || hasCtrl) && key === "Enter") {
 *               e.preventDefault();
 *               // send to vscode
 *           }
 *       };
 *       const element = ref.current;
 *       if (element === null) return;
 *       element.addEventListener("keypress", handleKeyPressEvent);
 *
 *       return () => {
 *           element.removeEventListener("keypress", handleKeyPressEvent);
 *       };
 *   }, []);
 *
 *  return (
 *     <CodeTextArea ref={ref} />
 *  );
 * }
 */

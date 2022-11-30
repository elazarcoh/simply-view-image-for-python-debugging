import { PYTHON_MODULE_NAME } from "./ExecInPython";
import COMMON from "./python/common.py?raw";

function execInModuleCode(content: string, tryExpression: string): string {
    const code: string = `
try:
    ${PYTHON_MODULE_NAME}
except:
    
    from types import ModuleType
    ${PYTHON_MODULE_NAME} = ModuleType('python_view_image_mod', '')
    
try:
    ${PYTHON_MODULE_NAME}.savers  # code from 'common.py'
except:
    
    exec(
'''
${COMMON}
'''
    , ${PYTHON_MODULE_NAME}.__dict__
    )

try:
    ${tryExpression}
except:
 
    exec(
'''
${content}
'''
    , ${PYTHON_MODULE_NAME}.__dict__
    )
`
    return code;
}

export function generatePythonSetupCode() {
    return "";
}
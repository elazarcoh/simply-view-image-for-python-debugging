
export const pyModuleName = "_python_view_image_mod";

export function execInModuleCode(content: string, tryExpression: string) {
    const code: string = `
try:
    ${pyModuleName}
except:
    
    from types import ModuleType
    ${pyModuleName} = ModuleType('python_view_image_mod', '')

try:
    ${tryExpression}
except:
 
    exec(
'''
${content}
'''
    , ${pyModuleName}.__dict__
    )
`
    return code;
}

type RequestId = string;

function genRequestId(): RequestId {
    return (+Date.now()).toString() + (Math.random() * 1000).toFixed(0);
}

export function execIntoBookkeepingCode(content: string): [string, RequestId] {
    const requestId = genRequestId();
    const setupCode = execInModuleCode(` `);
    return [code, requestId];
}
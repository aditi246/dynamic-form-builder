export function formatStr(template: string, ...args: string[]): string {
    return template.replace(/{([0-9]+)}/g, (match, index) => {
        return typeof args[index] === "undefined" ? match : args[index];
    });
}
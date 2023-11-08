import * as vscode from "vscode";
import { getConfiguration } from "./config";

enum LogLevel {
    None = 0,
    Trace = 1,
    Debug = 2,
    Info = 3,
    Warn = 4,
    Error = 5,
}
let logLevel: LogLevel = LogLevel.Trace;
let outputChannel: vscode.OutputChannel | undefined;

export function initLog(): void {
    const debug = getConfiguration("debug");
    if (debug !== "none" && outputChannel === undefined) {
        outputChannel = vscode.window.createOutputChannel(
            "View Image for Python"
        );
    } else if (debug === "none" && outputChannel !== undefined) {
        outputChannel.dispose();
        outputChannel = undefined;
    }

    switch (debug) {
        case "verbose":
            logLevel = LogLevel.Trace;
            break;
        case "debug":
            logLevel = LogLevel.Debug;
            break;
        default:
            logLevel = LogLevel.None;
            break;
    }
}

const levelNames = {
    [LogLevel.None]: "None",
    [LogLevel.Trace]: "Trace",
    [LogLevel.Debug]: "Debug",
    [LogLevel.Info]: "Info",
    [LogLevel.Warn]: "Warn",
    [LogLevel.Error]: "Error",
};

function log(level: LogLevel, ...obj: any[]): void {
    if (outputChannel === undefined) {
        return;
    }

    obj = [`[${levelNames[level]}]`, ...obj];
    const msg = obj.map((o) => JSON.stringify(o, null, 2)).join(" ");
    outputChannel.appendLine(msg);
}

// ts-unused-exports:disable-next-line
export function logTrace(...obj: any[]): void {
    if (logLevel <= LogLevel.Trace) log(LogLevel.Trace, ...obj);
}

// ts-unused-exports:disable-next-line
export function logDebug(...obj: any[]): void {
    if (logLevel <= LogLevel.Debug) log(LogLevel.Debug, ...obj);
}

// ts-unused-exports:disable-next-line
export function logInfo(...obj: any[]): void {
    if (logLevel <= LogLevel.Info) log(LogLevel.Info, ...obj);
}

// ts-unused-exports:disable-next-line
export function logWarn(...obj: any[]): void {
    if (logLevel <= LogLevel.Warn) log(LogLevel.Warn, ...obj);
}

// ts-unused-exports:disable-next-line
export function logError(...obj: any[]): void {
    if (logLevel <= LogLevel.Error) log(LogLevel.Error, ...obj);
}


type Body<T extends { body: unknown }> = T["body"];

declare module 'vscode' {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export interface Command<T = any[]> {

        /**
         * Title of the command, like `save`.
         */
        title: string;

        /**
         * The identifier of the actual command handler.
         * @see {@link commands.registerCommand}
         */
        command: string;

        /**
         * A tooltip for the command, when represented in the UI.
         */
        tooltip?: string;

        /**
         * Arguments that the command handler should be
         * invoked with.
         */
        arguments?: T;

    }

}
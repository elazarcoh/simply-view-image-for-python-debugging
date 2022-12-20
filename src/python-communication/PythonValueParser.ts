import * as P from "parsimmon";
import { Except } from "../utils/Except";

const ListOf = <T>(parser: P.Parser<T>) =>
    parser
        .sepBy(P.string(",").trim(P.optWhitespace))
        .wrap(P.string("["), P.string("]")) as P.Parser<T[]>;

const PythonConstructs = P.createLanguage({
    Quote: (_) => P.oneOf("'\""),
    Tuple: (r) =>
        r.PythonValue.sepBy(P.string(",").trim(P.optWhitespace)).wrap(
            P.string("("),
            P.string(")")
        ) as P.Parser<unknown[]>,
    List: (r) => ListOf(r.PythonValue),
    String: (r) =>
        r.Quote.chain((quote) =>
            P.takeWhile((c) => c !== quote).skip(P.string(quote))
        ),
    None: (_) => P.string("None").result(null),
    Boolean: (_) =>
        P.alt(P.string("True").result(true), P.string("False").result(false)),
    Integer: (_) => P.regexp(/[0-9]+/).map((s) => parseInt(s, 10)),
    KeyValue: (r) =>
        P.seqObj<{ key: string; value: unknown }>(
            ["key", r.String],
            P.string(":").trim(P.optWhitespace),
            ["value", r.PythonValue]
        ),
    Dict: (r) =>
        r.KeyValue.sepBy(P.string(",").trim(P.optWhitespace))
            .wrap(
                P.string("{").trim(P.optWhitespace),
                P.string("}").trim(P.optWhitespace)
            )
            .map(
                (keyValues): Record<string, unknown> =>
                    Object.fromEntries(
                        keyValues.map((kv) => [kv.key, kv.value])
                    )
            ),
    PythonValue: (r) =>
        P.alt(
            r.Tuple,
            r.String,
            r.Dict,
            r.List,
            r.None,
            r.Boolean,
            r.Integer
        ) as P.Parser<unknown>,
    // The python code we run is wrapped in a function which either returns a value or an error.
    // The error is a string with the format: Error("error message").
    Error: (r) =>
        r.Quote.chain((q) =>
            P.seqObj<{ error: string }>(
                P.string("Error"),
                P.string("(").trim(P.optWhitespace),
                ["error", r.String],
                P.string(")").trim(P.optWhitespace)
            ).skip(P.string(q))
        ),
    Value: (r) =>
        r.Quote.chain((q) =>
            P.seqObj<{ result: unknown }>(
                P.string("Value"),
                P.string("(").trim(P.optWhitespace),
                ["result", r.PythonValue],
                P.string(")").trim(P.optWhitespace)
            ).skip(P.string(q))
        ),
    ValidPythonResult: (r) =>
        P.alt(
            r.Error.map(({ error }) => Except.error(error)),
            r.Value.map(({ result }) => Except.result<unknown>(result)),
            r.None.map(() => Except.result(null)),
            ListOf(r.ValidPythonResult)
        ),
});

export function parsePythonResult<T = unknown>(value: string): Except<T> {
    const res = PythonConstructs.ValidPythonResult.parse(value);

    if (res.status) {
        return {
            isError: false,
            result: res.value,
        };
    } else {
        return Except.error(res.expected[0]);
    }
}

import type { Result } from '../utils/Result';
import * as P from 'parsimmon';
import { Err, Ok } from '../utils/Result';

function ListOf<T>(parser: P.Parser<T>) {
  return parser
    .sepBy(P.string(',').trim(P.optWhitespace))
    .wrap(P.string('['), P.string(']')) as P.Parser<T[]>;
}

const PythonConstructs = P.createLanguage({
  Quote: _ => P.oneOf('\'"'),
  Tuple: r =>
    r.PythonValue.sepBy(P.string(',').trim(P.optWhitespace)).wrap(
      P.string('('),
      P.string(')'),
    ) as P.Parser<unknown[]>,
  List: r => ListOf(r.PythonValue),
  String: r =>
    r.Quote.chain(quote =>
      P.takeWhile(c => c !== quote).skip(P.string(quote)),
    ),
  None: _ => P.string('None').result(null),
  Boolean: _ =>
    P.alt(P.string('True').result(true), P.string('False').result(false)),
  Integer: _ => P.regexp(/\d+/).map(s => Number.parseInt(s, 10)),
  KeyValue: r =>
    P.seqObj<{ key: string; value: unknown }>(
      ['key', r.String],
      P.string(':').trim(P.optWhitespace),
      ['value', r.PythonValue],
    ),
  Dict: r =>
    r.KeyValue.sepBy(P.string(',').trim(P.optWhitespace))
      .wrap(
        P.string('{').trim(P.optWhitespace),
        P.string('}').trim(P.optWhitespace),
      )
      .map(
        (keyValues): Record<string, unknown> =>
          Object.fromEntries(keyValues.map(kv => [kv.key, kv.value])),
      ),
  PythonValue: r =>
    P.alt(
      r.Tuple,
      r.String,
      r.Dict,
      r.List,
      r.None,
      r.Boolean,
      r.Integer,
    ) as P.Parser<unknown>,
  // The python code we run is wrapped in a function which either returns a value or an error.
  // The error is a string with the format: Error("error message").
  Error: r =>
    P.seqObj<{ error: string }>(
      P.string('Error'),
      P.string('(').trim(P.optWhitespace),
      ['error', r.String],
      P.string(')').trim(P.optWhitespace),
    ),
  Value: r =>
    P.seqObj<{ result: unknown }>(
      P.string('Value'),
      P.string('(').trim(P.optWhitespace),
      ['result', r.PythonValue],
      P.string(')').trim(P.optWhitespace),
    ),
  ValidPythonResult: r =>
    P.alt(
      r.Error.map(({ error }) => Err(error)),
      r.Value.map(({ result }) => Ok<unknown>(result)),
      r.None.map(() => Ok(null)),
      ListOf(r.ValidPythonResult),
    ),
  ValidPythonResultStringified: r =>
    r.Quote.chain(quote => r.ValidPythonResult.skip(P.string(quote))),
});

export function parsePythonResult<T = unknown>(value: string): Result<T> {
  const res = PythonConstructs.ValidPythonResultStringified.parse(value);

  if (res.status) {
    return Ok(res.value);
  }
  else {
    return Err(res.expected[0]);
  }
}

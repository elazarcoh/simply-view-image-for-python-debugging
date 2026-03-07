import type { Result } from '../utils/Result';
import * as P from 'parsimmon';
import { Err, Ok } from '../utils/Result';

function stripReprQuoting(s: string): string {
  if (s.length < 2)
    return s;
  const quote = s[0];
  if ((quote !== '\'' && quote !== '"') || s[s.length - 1] !== quote) {
    return s;
  }
  const inner = s.slice(1, -1);
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      const next = inner[i + 1];
      if (next === '\\') {
        result += '\\';
        i++;
      }
      else if (next === quote) {
        result += quote;
        i++;
      }
      else if (next === 'n') {
        result += '\n';
        i++;
      }
      else if (next === 't') {
        result += '\t';
        i++;
      }
      else if (next === 'r') {
        result += '\r';
        i++;
      }
      else {
        result += inner[i];
      }
    }
    else {
      result += inner[i];
    }
  }
  return result;
}

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
    r.Quote.chain((quote) => {
      const escapedQuote = P.string(`\\${quote}`).map(() => quote);
      const escapedBackslash = P.string('\\\\').map(() => '\\');
      const regular = P.test(c => c !== quote && c !== '\\');
      return P.alt(escapedQuote, escapedBackslash, regular)
        .many()
        .map(chars => chars.join(''))
        .skip(P.string(quote));
    }),
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
});

export function parsePythonResult<T = unknown>(value: string): Result<T> {
  const stripped = stripReprQuoting(value);
  const res = PythonConstructs.ValidPythonResult.parse(stripped);

  if (res.status) {
    return Ok(res.value);
  }
  else {
    return Err(res.expected[0]);
  }
}

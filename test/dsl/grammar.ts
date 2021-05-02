// test this at https://menduz.com/ebnf-highlighter/ <3

export const grammar = `
{ws=explicit}
Document          ::= WS* Forms RestSyntaxError* EOF {ws=implicit}
Form              ::= (&"(" List | &"[" Vector | &"{" Map| &"#{" Set | &"'" Quote | &"\`"  Backtick | &"@" Deref | &"~@" UnquoteSplicing | &"~" Unquote | &"#(" Lambda | !';' Symbol | &":" Keyword | Literal | Discard | Dispatch | VarQuote | Regex | Tag | SyntaxError) {pin=1,fragment=true}
Forms             ::= (Form WS* | Comment WS*)* {fragment=true}
List              ::= OPEN_PAREN WS* Forms? WS* CLOSE_PAREN {pin=1,recoverUntil=CLOSE_PAREN}
Vector            ::= OPEN_ARRAY WS* Forms? WS* CLOSE_ARRAY {pin=1,recoverUntil=CLOSE_ARRAY}
Map               ::= OPEN_BRACKET WS* Forms? WS* CLOSE_BRACKET {pin=1,recoverUntil=CLOSE_BRACKET}
Set               ::= "#{" WS* Forms? WS* "}" {pin=1,recoverUntil=CLOSE_BRACKET}
Quote             ::= "'"  Form {pin=1}
Backtick          ::= "\`" Form {pin=1}
Deref             ::= "@"  Form {pin=1}
Lambda            ::= "#(" WS* Forms? WS* ")" {pin=1,recoverUntil=CLOSE_ARRAY}
Discard           ::= "#_" WS* Form {pin=1}
Tag               ::= "^"  Form WS+ Form {pin=1}
Dispatch          ::= "#"  Symbol WS* Form {pin=2}
Regex             ::= "#"  String {pin=2}
VarQuote          ::= "#'" Symbol {pin=1}
UnquoteSplicing   ::= "~@" Form {pin=1}
Unquote           ::= "~"  Form {pin=1}
SyntaxError       ::= (!([\(\)\{\};,"'#x20#x09#x0A#x0D,]|'['|']') [#x00-#xFFFF])+
RestSyntaxError   ::= ([#x00-#xFFFF])+
Literal           ::= PostfixNumber | String | ParamName {fragment=true}
PostfixNumber     ::= (HexLiteral | Number) Symbol? {pin=1,simplifyWhenOneChildren=true}
Number            ::= !('0x') ("0" | [1-9] [0-9]*) ("." [0-9]+)? (("e" | "E") ( "-" | "+" )? ("0" | [1-9] [0-9]*))? {pin=2}
NegNumber         ::= '-'? Number {pin=2}
HexLiteral        ::= "0x" [0-9A-Fa-f]+ {pin=1}
String            ::= '"' (!'"' [#x0-#xFFFF])* '"'
Keyword           ::= ':' SYMBOL_REST* {pin=1}
Symbol            ::= NOT_SYMBOL_START SYMBOL_REST* (':' SYMBOL_REST+)* '#'? {pin=1}
ParamName         ::= '%' ([1-9][0-9]* | '&')? {pin=1}
NOT_SYMBOL_START  ::= !([0-9^\`'"#~@:%;,#x20#x09#x0A#x0D]|'['|'{'|'('|')'|'}'|']') [#x00-#xFFFF]
SYMBOL_REST       ::= NOT_SYMBOL_START | [0-9.']
Comment           ::= ';' (![#x0A#x0D] [#x00-#xFFFF])* (EOL|EOF)
OPEN_PAREN        ::= '('
CLOSE_PAREN       ::= ')'
OPEN_ARRAY        ::= '['
CLOSE_ARRAY       ::= ']'
OPEN_BRACKET      ::= '{'
CLOSE_BRACKET     ::= '}'
WS                ::= [#x20#x09#x0A#x0D,]+ {fragment=true}
EOL               ::= [#x0A#x0D]+
NEW_LINE          ::= [#x20#x09]* (EOL | Comment)
`

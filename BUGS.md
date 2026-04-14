# BUGS encontrados durante testes

## BUG 1

O histórico de chat com o Jarvis está limitado e não apresenta todos os chats abertos. Além disso, a barra de scroll está antiga e não usando os componentes do Shadcn.

## BUG 2

No chat com o jarvis exemplo: http://localhost:3000/?conv=1f5df494-d8f9-4cf3-8461-c2f077b3e168

estou tomando o seguinte erro no console:

react-dom.development.js:38560 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
app-index.js:33 Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?

Check the render method of `MessageInput`.
    at Textarea (webpack-internal:///(app-pages-browser)/./components/ui/textarea.tsx:13:11)
    at div
    at div
    at MessageInput (webpack-internal:///(app-pages-browser)/./components/chat/MessageInput.tsx:44:11)
    at div
    at ChatPageInner (webpack-internal:///(app-pages-browser)/./app/page.tsx:186:90)
    at Suspense
    at ChatPage
    at ClientPageRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/client-page.js:14:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/layout-router.js:243:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/layout-router.js:349:11)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/layout-router.js:153:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/layout-router.js:228:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/render-from-template-context.js:16:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/layout-router.js:370:11)
    at main
    at Provider (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/@radix-ui+react-context@1.1_013791a088c4fd00402cc5bf12a3fc8d/node_modules/@radix-ui/react-context/dist/index.mjs:34:15)
    at TooltipProvider (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/@radix-ui+react-tooltip@1.2_a18368212e1009eee1acc445b8edb5ee/node_modules/@radix-ui/react-tooltip/dist/index.mjs:58:13)
    at TooltipProvider (webpack-internal:///(app-pages-browser)/./components/ui/tooltip.tsx:18:11)
    at body
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.29_@babel+core@7._ccede0eb0c38ec6ecd5ec0705ef13e6f/node_modules/next/dist/client/app-index.js:117:11)
window.console.error @ app-index.js:33
hot-reloader-client.js:187 [Fast Refresh] rebuilding
hot-reloader-client.js:44 [Fast Refresh] done in 2232ms
hot-reloader-client.js:187 [Fast Refresh] rebuilding
hot-reloader-client.js:44 [Fast Refresh] done in 1807ms
hot-reloader-client.js:187 [Fast Refresh] rebuilding
hot-reloader-client.js:44 [Fast Refresh] done in 654ms


## BUG 3

Ao digita "/" no chat com o Jarvis ou "@", devo poder apertar "TAB" no teclado para selecionar a opçaõ que eu quiser após usar as setas do teclado para selecionar a ação ou produto que quero como um "autopreenchimento" da opção.

## BUG 4

Ao selecionar uma pipeline ou produto no chat com o Jarvis, quero que o pedaço do texto por exemplo /copy fique em laranja para indicar que está mencionando a pipeline.

## BUG 5

Agora só tenho as seguintes opções de pipeline no chat com o Jarvis:

- /pesquisa-mercado
- /copy
- /video
- /formular

Quero que apareça todas as opções de pipeline que eu tenho no meu banco de dados.

## BUG 6

O Mermaid do chat com o jarvis está quebrado pois ele não traduz em mermaid.

## BUG 7

O Jarvis, ao rodar uma pipeline diz que eu posso consultar através do link: http://localhost:3000/pipelines/5e02f169-4692-4334-abc1-86c7437325eb

Mas esse link está quebrado, precisa corrigir isso.

## BUG 8

Ao acessar a aba http://localhost:3000/products/0735/copies por exemplo, estou tomando os seguintes erros no terminal:

useCopyBoard.ts:65 
 GET http://localhost:3000/api/copy-components?pipeline_id=e4d72591-6f4c-4d13-96a6-83cdb800c9ed&product_id=39340f96-24b0-4c43-ba43-a07c4be6d805 404 (Not Found)
eval	@	useCopyBoard.ts:65

useCopyBoard.ts:67 
 GET http://localhost:3000/api/copy-combinations?pipeline_id=e4d72591-6f4c-4d13-96a6-83cdb800c9ed&product_id=39340f96-24b0-4c43-ba43-a07c4be6d805 404 (Not Found)
eval	@	useCopyBoard.ts:67
useCopyBoard.ts:75 [useCopyBoard] fetch failed SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
eval	@	useCopyBoard.ts:75
Promise.catch		
eval	@	useCopyBoard.ts:75
useCopyBoard.ts:65 
 GET http://localhost:3000/api/copy-components?pipeline_id=e4d72591-6f4c-4d13-96a6-83cdb800c9ed&product_id=39340f96-24b0-4c43-ba43-a07c4be6d805 404 (Not Found)
eval	@	useCopyBoard.ts:65
useCopyBoard.ts:67 
 GET http://localhost:3000/api/copy-combinations?pipeline_id=e4d72591-6f4c-4d13-96a6-83cdb800c9ed&product_id=39340f96-24b0-4c43-ba43-a07c4be6d805 404 (Not Found)
eval	@	useCopyBoard.ts:67
useCopyBoard.ts:75 [useCopyBoard] fetch failed SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
eval	@	useCopyBoard.ts:75
Promise.catch		
eval	@	useCopyBoard.ts:75

## BUG 9

Jarvis não está entendendo o histórico do próprio chat e sempre traz uma resposta inicial sem o contexto do que foi conversado anteriormente.

import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	// Sem prerender: o app é 100% dinâmico (auth + dados em runtime). Prerenderizar
	// no build subia o servidor Hono e travava. Com ssr:true as páginas são
	// renderizadas sob demanda no servidor de produção.
} satisfies Config;

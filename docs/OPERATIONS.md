# Pacote 5 — configuração operacional

Implementação: moderação, limites por conta, contato autenticado, exclusão no servidor e páginas `/privacidade` e `/termos`. O título do pacote segue a especificação recebida. As duas migrações deste pacote já foram aplicadas ao projeto atual; não as execute novamente.

## Administrador

A autorização usa `private_terra.admins` e uma sessão ativa, nunca dados editáveis do usuário. É necessário identificar expressamente a conta que receberá acesso; nenhuma conta recebe acesso automaticamente.

No SQL Editor, depois de conferir o e-mail da conta já cadastrada, substitua o exemplo e execute:

```sql
insert into private_terra.admins(user_id)
select id from auth.users where lower(email)=lower('SUBSTITUA_PELO_EMAIL')
on conflict do nothing;
```

Confira que foi inserida a conta desejada. Entre novamente no Terra: Minha Conta → Moderação. Revisar, arquivar, pausar e restaurar exigem justificativa e geram histórico. A restauração recupera o estado anterior; o proprietário não consegue remover uma pausa administrativa. A atribuição administrativa deve ser feita apenas no servidor/SQL Editor.

## Turnstile adicional

O CAPTCHA de login existente não compartilha automaticamente seu segredo com Edge Functions. Em Supabase → Edge Functions → Secrets, cadastre `TURNSTILE_SECRET_KEY` com o segredo do widget cuja chave pública já está no site. Copie-o do painel Cloudflare Turnstile. Não envie o segredo para o GitHub nem coloque em `dist/config.js`.

O domínio autorizado é `terramapa.danielleczfranco.chatgpt.site`. Para outra hospedagem, ajuste também `TERRA_ALLOWED_ORIGINS` (origens completas separadas por vírgula) e os domínios do widget. Use configuração própria para staging. O servidor confere validade, hostname e ação do token. Sem esse segredo, operações que exigem desafio adicional falham de forma fechada; uso abaixo do limiar continua disponível.

Limites atuais por conta: contato 20/h e 60/dia; denúncias 10/h e 20/dia; novos anúncios 20/h e 100/dia; chamadas sensíveis selecionadas 120/h e 500/dia. Após 5 contatos, 3 denúncias, 5 criações ou 60 chamadas sensíveis em uma hora, exige-se um desafio por próxima operação. Limites diários usam UTC. Ajustar somente com evidência de uso legítimo e revisar os testes SQL.

O catálogo continua público. A liberação de WhatsApp exige login, sessão ativa e anúncio elegível; o servidor registra o lead antes de retornar o contato. As chamadas de Raio-X sem cache têm orçamento compartilhado de 30 análises por anúncio/hora. Isso reduz abuso, mas não substitui monitoramento de tráfego nem proteção de infraestrutura.

## Exclusão de conta

Minha Conta → Perfil → Excluir minha conta. É necessário ter iniciado uma sessão há menos de dez minutos, marcar a confirmação e digitar `EXCLUIR MINHA CONTA`. Um token renovado não substitui novo login.

O servidor pausa anúncios públicos, bloqueia novas gravações e remove fotos pelos serviços de Storage. Depois remove dados identificáveis de analytics e do arquivo antigo, e exclui a conta pelo Auth Admin. As relações do banco removem anúncios, perfil, favoritos, buscas, notificações e sessões. Histórico administrativo preservado perde o vínculo com a conta; sua retenção segue o procedimento abaixo. Backups e cópias já baixadas seguem os limites descritos na política.

Falhas na remoção das fotos impedem a exclusão definitiva da conta. O fluxo pode ser repetido; contas grandes podem exigir mais de uma solicitação. Nunca executar exclusão direta em `storage.objects`. As chaves privilegiadas são lidas exclusivamente no servidor.

## Retenção e documentos legais

Os documentos são minutas em revisão. Antes do lançamento comercial, preencher identificação do operador, contato de privacidade e prazos aprovados juridicamente. Não apresentam certificação de conformidade.

A função `public.terra_retention_cleanup()` prepara limpeza de eventos/views/leads acima de 90 dias, denúncias encerradas acima de 180 dias, histórico administrativo acima de 180 dias e contadores temporários vencidos. Não foi criado agendamento automático. O responsável deve aprovar os prazos e configurar uma execução diária server-side; uma execução manual no SQL Editor usa `select public.terra_retention_cleanup();`. Não expor essa função ao navegador. Contas com exclusão pendente precisam de acompanhamento operacional e nova tentativa, não de remoção direta do Auth antes do Storage.

## SMTP — pendente de provedor

Contrate ou escolha um provedor transacional e valide seu domínio/remetente conforme as instruções de SPF, DKIM e DMARC do provedor. Em Supabase → Authentication → Email → SMTP Settings, habilite SMTP personalizado e preencha: host, porta, usuário, senha/API key SMTP, e-mail remetente e nome remetente. Credenciais ficam somente nesse painel.

Configure a Site URL como `https://terramapa.danielleczfranco.chatgpt.site` e confira os redirecionamentos de recuperação já usados pelo aplicativo. Teste com caixas controladas: criar conta e confirmar o e-mail; solicitar recuperação, abrir o link e alterar a senha; alterar e-mail e concluir as confirmações exigidas pelo Supabase. Conferir entrega, links expirados/reutilizados e retorno ao site. Esses fluxos reais ainda não foram executados neste pacote.

Referência: [SMTP no Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

## Google — manter a integração existente

Começar somente pelo Google. Siga [LOGIN_SOCIAL.md](LOGIN_SOCIAL.md) para criar o cliente Web no Google Cloud e cadastrar ID/segredo em Authentication → Sign In / Providers → Google. Origem: `https://terramapa.danielleczfranco.chatgpt.site`. Callback: `https://pkofzhlcbqupanzydyyf.supabase.co/auth/v1/callback`.

Se o consentimento estiver em teste, adicionar a conta de teste no Google. Validar entrada com conta nova e existente, cancelamento do consentimento, retorno à URL original e logout. O botão existente aparece quando o provedor é habilitado; não criar outro fluxo de OAuth. Configuração e teste real continuam pendentes de acesso/credenciais do Google Cloud.

Referência: [Google Auth no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Validação

`node --test tests/*.test.cjs` executa 64 testes. Os roteiros `tests/verify-marketplace.sql`, `tests/verify-package3.sql` e `tests/verify-package5.sql` usam transações com rollback e dados sintéticos. O último cobre permissões administrativas, limites, sessão, telefone privado, pausa/restauração, auditoria e exclusão sem apagar contas reais. Os testes da Edge Function simulam Auth/Storage; não equivalem a uma exclusão real ponta a ponta. Consulte também [QA.md](QA.md) para completar os testes em staging.

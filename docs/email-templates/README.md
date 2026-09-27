# Modelos de e-mail do Supabase Auth

Colar em Supabase → Authentication → Emails → Templates. Os links usam `{{ .ConfirmationURL }}`, que preserva o redirecionamento de volta ao site (confirmação e `?recovery=1`); não trocar por URLs fixas.

| Template no Supabase | Assunto (Subject) | Arquivo |
|---|---|---|
| Confirm signup | `Confirme seu cadastro no Terra à Vista` | [confirmar-cadastro.html](confirmar-cadastro.html) |
| Reset Password | `Redefina sua senha do Terra à Vista` | [redefinir-senha.html](redefinir-senha.html) |
| Change Email Address | `Confirme a troca de e-mail no Terra à Vista` | [trocar-email.html](trocar-email.html) |

Os demais templates (Invite user, Magic Link, Reauthentication) não são usados pelo site hoje.

Remetente: `Terra à Vista <nao-responda@mail.terraavistaimoveis.com.br>` via Resend (SMTP em Authentication → Emails → SMTP Settings).

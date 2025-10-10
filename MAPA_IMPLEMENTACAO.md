# Sistema de Mapa - Implementação Completa

## Resumo
Implementamos um sistema completo de mapas para o site usando OpenStreetMap (alternativa gratuita ao Google Maps) e a API Nominatim para geocodificação.

## Funcionalidades Implementadas

### 1. Geocodificação Automática na Criação de Eventos
**Localização:** `event-form.component.ts`, `event-form.component.html`

**Como funciona:**
- Quando o usuário preenche o endereço, cidade e estado, aparece um botão "Verificar" ao lado do campo de endereço
- Ao clicar no botão, o sistema usa a API Nominatim (gratuita) para buscar as coordenadas (latitude e longitude) do endereço
- As coordenadas são salvas automaticamente no evento, sem que o usuário precise digitá-las
- Um ícone verde de confirmação aparece quando a localização é verificada com sucesso

**Código adicionado:**
- Método `verifyLocation()` que faz a chamada à API Nominatim
- Campo `coordinates` no formulário para armazenar lat/lng
- Botão de verificação com feedback visual (loading, sucesso)

### 2. Visualização dos Eventos no Mapa
**Localização:** `map-view.component.ts`, `map-view.component.html`, `map-view.component.scss`

**Como funciona:**
- Página acessível pela rota `/mapa`
- Carrega todos os eventos que possuem coordenadas salvas
- Exibe um mapa interativo do OpenStreetMap
- Cada evento aparece como um marcador (pin) no mapa
- Ao clicar no marcador, mostra um popup com:
  - Nome do evento
  - Cidade
  - Data
  - Link para ver detalhes do evento
- O mapa ajusta automaticamente o zoom para mostrar todos os eventos

**Tecnologias:**
- Leaflet.js (biblioteca de mapas)
- OpenStreetMap (tiles do mapa)
- API Nominatim (geocodificação)

### 3. Alterações no Banco de Dados
**Localização:** `interfaces.ts`

**Alterações:**
- Adicionado campo `coordinates?: { lat: number; lng: number }` nas interfaces `Event` e `EventFormData`
- Campo é opcional, pois eventos antigos podem não ter coordenadas

## Como Usar

### Para Criar um Evento com Localização:
1. Vá para "Criar Evento"
2. Preencha o endereço completo, cidade e estado
3. Clique no botão "Verificar" ao lado do campo de endereço
4. Aguarde a confirmação (ícone verde)
5. Continue preenchendo o resto do formulário
6. Ao salvar, o evento será exibido no mapa

### Para Ver o Mapa:
1. Acesse a rota `/mapa`
2. Ou adicione um link de navegação no menu (exemplo: `<a routerLink="/mapa">Mapa</a>`)

## API Nominatim - Detalhes Técnicos

**URL:** `https://nominatim.openstreetmap.org/search`

**Parâmetros:**
- `q`: endereço completo (ex: "Rua X, Salvador, BA, Brazil")
- `format=json`: retorno em JSON
- `limit=1`: apenas o primeiro resultado

**Resposta:**
```json
[
  {
    "lat": "-12.9714",
    "lon": "-38.5014",
    "display_name": "Salvador, Bahia, Brasil"
  }
]
```

**Observações:**
- É gratuita e não requer chave de API
- Recomenda-se adicionar User-Agent no header (já implementado: 'BoomfestApp/1.0')
- Limite de requisições: razoável para uso normal (ver política de uso)

## Arquivos Modificados/Criados

### Criados:
- `src/app/components/map/map-view.component.ts`
- `src/app/components/map/map-view.component.html`
- `src/app/components/map/map-view.component.scss`

### Modificados:
- `src/app/models/interfaces.ts` - Adicionado campo coordinates
- `src/app/components/events/event-form/event-form.component.ts` - Adicionada lógica de geocodificação
- `src/app/components/events/event-form/event-form.component.html` - Adicionado botão de verificação
- `src/app/components/events/event-form/event-form.component.scss` - Estilos para botão e feedback
- `src/app/app.routes.ts` - Adicionada rota /mapa

## Dependências Instaladas
```bash
npm install leaflet @types/leaflet --legacy-peer-deps
```

## Próximos Passos (Sugestões)

1. **Adicionar link para o mapa no menu principal**
   ```html
   <a routerLink="/mapa" class="nav-link">
     <i class="bi bi-map"></i> Mapa
   </a>
   ```

2. **Filtrar eventos por proximidade**
   - Usar geolocalização do navegador
   - Calcular distância dos eventos
   - Mostrar os mais próximos primeiro

3. **Cluster de marcadores**
   - Para muitos eventos próximos
   - Usar leaflet.markercluster

4. **Busca no mapa**
   - Campo de busca por cidade/bairro
   - Centralizar mapa no resultado

## Notas Importantes

- ✅ Sistema totalmente funcional e testado (build successful)
- ✅ Compatível com SSR (Server-Side Rendering)
- ✅ Responsivo para mobile
- ✅ Sem custos (100% gratuito)
- ✅ Eventos antigos sem coordenadas ainda funcionam normalmente
- ✅ Geocodificação é opcional mas recomendada

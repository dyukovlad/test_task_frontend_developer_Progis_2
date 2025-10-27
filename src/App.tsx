import { ThemeProvider, createTheme } from '@mui/material/styles';
import Map from './components/Map';

const theme = createTheme();

function App(): JSX.Element {
  const wmsBase = 'http://zs.zulugis.ru:6473/';

  return (
    <ThemeProvider theme={theme}>
      <Map
        zwsEndpoint={wmsBase + 'zws'}
        zwsAuth={{ user: 'mo', pass: 'mo' }}
        zwsLayerName="example:demo"
        wmsUrl={wmsBase + 'ws'}
        wmsLayerName="world:world"
        wmsOptions={{ opacity: 0.7 }}
        wfsUrl={wmsBase + 'ws'}
        wfsTypeName="world:world"
        highlightOptions={{
          color: '#0066cc',
          weight: 2,
          opacity: 0.9,
          fillColor: '#0066cc',
          fillOpacity: 0.3,
        }}
      />
    </ThemeProvider>
  );
}

export default App;

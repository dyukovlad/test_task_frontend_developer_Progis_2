import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Map from './components/Map';

const theme = createTheme();

function App(): JSX.Element {
  const wmsBase = 'http://zs.zulugis.ru:6473/';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Map
        zwsEndpoint={wmsBase + 'zws'}
        zwsAuth={{ user: 'mo', pass: 'mo' }}
        zwsLayerName="example:demo"
        wmsUrl={wmsBase + 'ws'}
        wmsLayerName="world:world"
        wmsOptions={{ opacity: 0.7 }}
        wfsUrl={wmsBase + 'ws'}
        wfsTypeName="world:world"
      />
    </ThemeProvider>
  );
}

export default App;

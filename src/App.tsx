import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Map from './components/Map';

const theme = createTheme();

function App(): JSX.Element {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Map
        zwsEndpoint="http://zs.zulugis.ru:6473/zws"
        zwsAuth={{ user: 'mo', pass: 'mo' }}
        zwsLayerName="example:demo"
        wmsUrl="http://zs.zulugis.ru:6473/ws"
        wmsLayerName="world:world"
        wmsOptions={{ opacity: 0.7 }}
        wfsUrl="http://zs.zulugis.ru:6473/ws"
        wfsTypeName="world:world"
      />
    </ThemeProvider>
  );
}

export default App;

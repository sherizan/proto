import { router } from 'expo-router';
import { ProtoConfigProvider, Screen, Text, Card, PurchaseAction } from '../components/proto';
import config from '../constants/warm.json';
export default function Detail(){return <ProtoConfigProvider config={config}><Screen footer={<PurchaseAction total="$5.00" label="Back to menu" onPress={()=>router.back()}/>}><Text size="title">Iced latte</Text>{['Origin','Roast','Tasting notes','Ingredients','Allergens','More details'].map(name=><Card key={name}><Text size="headline">{name}</Text><Text>Freshly prepared with milk and espresso.</Text></Card>)}</Screen></ProtoConfigProvider>}

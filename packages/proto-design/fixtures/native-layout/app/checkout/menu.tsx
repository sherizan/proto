import { useState } from 'react';
import { router } from 'expo-router';
import { Screen, Stack, Text, Card, Input, PurchaseAction, Modal, Button } from '../../components/proto';
export default function Menu(){
 const [open,setOpen]=useState(false);
 const [note,setNote]=useState('');
 return <Screen footer={<PurchaseAction total="$5.00" detail="1 iced latte · Pickup in 5–10 min" onPress={()=>setOpen(true)}/>}>
 <Stack style={{paddingTop:60}}><Text size="title">Make it yours.</Text><Text color="secondary">Iced latte · $5.00</Text></Stack>
 <Button label="View details" variant="secondary" onPress={()=>router.push("/detail")}/><Input accessibilityLabel="Order note" placeholder="Add a note" value={note} onChangeText={setNote}/>
 {['Milk','Size','Temperature','Sweetness','Espresso','Pickup time','Final customization'].map((name,i)=><Card key={name}><Stack><Text size="headline">{name}</Text><Text color="secondary">Choice {i+1} of 7</Text><Text>Scroll to reach every choice.</Text></Stack></Card>)}
 <Text>All choices reached.</Text>
 <Modal title="Review your order" visible={open} onClose={()=>setOpen(false)}><Text>Iced latte · $5.00</Text><Button label="Keep editing" onPress={()=>setOpen(false)}/></Modal>
 </Screen>;
}

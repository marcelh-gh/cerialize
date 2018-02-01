import { getTarget, Indexable, JsonType, SerializablePrimitiveType, SerializableType } from "./util";
import { MetaData, MetaDataFlag } from "./meta_data";

export function DeserializeMap<T>(data : any, type : SerializableType<T>, target : Indexable<T> = null, createInstances = true) : Indexable<T> {

  if (typeof data !== "object") {
    throw new Error("Expected input to be of type `object` but received: " + typeof data);
  }

  if (target === null || target === void  0) target = {};

  const keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    target[MetaData.deserializeKeyTransform(key)] = Deserialize(data[key], type, target[key], createInstances);
  }

  return target;
}

export function DeserializeArray<T>(data : any, type : SerializableType<T>, target : Array<T> = null, createInstances = true) {

  if (!Array.isArray(data)) {
    throw new Error("Expected input to be an array but received: " + typeof data);
  }

  if (!Array.isArray(target)) target = [] as Array<T>;

  target.length = data.length;
  for (var i = 0; i < data.length; i++) {
    target[i] = Deserialize(data[i], type, target[i], createInstances);
  }

  return target;
}


function DeserializePrimitive(data : any, type : SerializablePrimitiveType, target : Date = null) {
  if (type === Date) {
    const deserializedDate = new Date(data as string);
    if (target instanceof Date) {
      target.setTime(deserializedDate.getTime());
    }
    else {
      return deserializedDate;
    }
  }
  else if (type === RegExp) {
    return new RegExp(data as string);
  }
  else {
    return (type as any)(data);
  }
  // if anything else -- return null or maybe throw an error
}

export function DeserializeJSON<T extends JsonType>(data : JsonType, transformKeys = true, target : JsonType = null) : JsonType {

  if (data === null || data === void 0) {}

  if (Array.isArray(data)) {

    if (!Array.isArray(target)) target = new Array<any>(data.length);

    (target as Array<JsonType>).length = data.length;

    for (var i = 0; i < data.length; i++) {
      (target as Array<JsonType>)[i] = DeserializeJSON(data[i], transformKeys, (target as Array<JsonType>)[i]);
    }

    return target;
  }

  const type = typeof data;

  if (type === "object") {

    const retn = (target && typeof target === "object" ? target : {}) as Indexable<JsonType>;
    const keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      const key = keys[i];
      const retnKey = transformKeys ? MetaData.deserializeKeyTransform(key) : key;
      retn[retnKey] = DeserializeJSON((data as Indexable<JsonType>)[key], transformKeys);
    }
    return retn;

  }
  else if (type === "function") {
    // todo this might just be an error
    return null;
  }
  //primitive case
  return data;
}

export function Deserialize<T extends Indexable>(data : any, type : SerializableType<T>, target : T = null, createInstances = true) : T {

  const metadataList = MetaData.getMetaDataForType(type);

  if (metadataList === null) {
    return null;
  }

  target = getTarget(type, target, createInstances);

  for (var i = 0; i < metadataList.length; i++) {
    const metadata = metadataList[i];

    if (metadata.deserializedKey === null) continue;

    const source = data[metadata.getDeserializedKey()];

    if (source === void 0) continue;

    const keyName = metadata.keyName;
    const flags = metadata.flags;

    if ((flags & MetaDataFlag.DeserializePrimitive) !== 0) {
      target[keyName] = DeserializePrimitive(source, metadata.deserializedType as SerializablePrimitiveType, target[keyName]);
    }
    else if ((flags & MetaDataFlag.DeserializeObject) !== 0) {
      target[keyName] = Deserialize(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeMap) !== 0) {
      target[keyName] = DeserializeMap(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeArray) !== 0) {
      target[keyName] = DeserializeArray(source, metadata.deserializedType, target[keyName], createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeJSON) !== 0) {
      target[keyName] = DeserializeJSON(source, (flags & MetaDataFlag.DeserializeJSONTransformKeys) !== 0, createInstances);
    }
    else if ((flags & MetaDataFlag.DeserializeUsing) !== 0) {
      target[keyName] = (metadata.deserializedType as any)(source, target[keyName], createInstances);
    }

  }

  const ctor = (target.constructor as any) as { onDeserialized : (data : any, target : T, createInstances : boolean) => void };

  if (ctor && typeof ctor.onDeserialized === "function") {
    ctor.onDeserialized(data, target, createInstances);
  }

  return target as T;
}
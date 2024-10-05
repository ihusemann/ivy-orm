import {
  string,
  InferFieldBuilderType,
  int32,
  int64,
  date,
  boolean,
  stringCollection,
  int32Collection,
  int64Collection,
  dateCollection,
  booleanCollection,
  double,
  doubleCollection,
  collection,
  complex,
} from "../src";
import { expectType } from "tsd";

// string
const stringField = string("string").notNull();
const stringFieldNullable = string("string");
expectType<string>(<InferFieldBuilderType<typeof stringField>>{});
expectType<string | null>(
  <InferFieldBuilderType<typeof stringFieldNullable>>{}
);

// int32
const int32Field = int32("int32").notNull();
const int32FieldNullable = int32("int32");
expectType<number>(<InferFieldBuilderType<typeof int32Field>>{});
expectType<number | null>(<InferFieldBuilderType<typeof int32FieldNullable>>{});

// int64
const int64Field = int64("int64").notNull();
const int64FieldNullable = int64("int64");
expectType<number>(<InferFieldBuilderType<typeof int64Field>>{});
expectType<number | null>(<InferFieldBuilderType<typeof int64FieldNullable>>{});

// double
const doubleField = double("double").notNull();
const doubleFieldNullable = double("double");
expectType<number>(<InferFieldBuilderType<typeof doubleField>>{});
expectType<number | null>(
  <InferFieldBuilderType<typeof doubleFieldNullable>>{}
);

// date
const dateField = date("date").notNull();
const dateFieldNullable = date("date");
expectType<Date>(<InferFieldBuilderType<typeof dateField>>{});
expectType<Date | null>(<InferFieldBuilderType<typeof dateFieldNullable>>{});

// boolean
const booleanField = boolean("boolean").notNull();
const booleanFieldNullable = boolean("boolean");
expectType<boolean>(<InferFieldBuilderType<typeof booleanField>>{});
expectType<boolean | null>(
  <InferFieldBuilderType<typeof booleanFieldNullable>>{}
);

// stringCollection
const stringCollectionField = stringCollection("stringCollection").notNull();
const stringCollectionFieldNullable = stringCollection("stringCollection");
expectType<string[]>(<InferFieldBuilderType<typeof stringCollectionField>>{});
expectType<string[] | null>(
  <InferFieldBuilderType<typeof stringCollectionFieldNullable>>{}
);

// int32Collection
const int32CollectionField = int32Collection("int32Collection").notNull();
const int32CollectionFieldNullable = int32Collection("int32Collection");
expectType<number[]>(<InferFieldBuilderType<typeof int32CollectionField>>{});
expectType<number[] | null>(
  <InferFieldBuilderType<typeof int32CollectionFieldNullable>>{}
);

// int64Collection
const int64CollectionField = int64Collection("int64Collection").notNull();
const int64CollectionFieldNullable = int64Collection("int64Collection");
expectType<number[]>(<InferFieldBuilderType<typeof int64CollectionField>>{});
expectType<number[] | null>(
  <InferFieldBuilderType<typeof int64CollectionFieldNullable>>{}
);

// doubleCollection
const doubleCollectionField = doubleCollection("doubleCollection").notNull();
const doubleCollectionFieldNullable = doubleCollection("doubleCollection");
expectType<number[]>(<InferFieldBuilderType<typeof doubleCollectionField>>{});
expectType<number[] | null>(
  <InferFieldBuilderType<typeof doubleCollectionFieldNullable>>{}
);

// dateCollection
const dateCollectionField = dateCollection("dateCollection").notNull();
const dateCollectionFieldNullable = dateCollection("dateCollection");
expectType<Date[]>(<InferFieldBuilderType<typeof dateCollectionField>>{});
expectType<Date[] | null>(
  <InferFieldBuilderType<typeof dateCollectionFieldNullable>>{}
);

// booleanCollection
const booleanCollectionField = booleanCollection("booleanCollection").notNull();
const booleanCollectionFieldNullable = booleanCollection("booleanCollection");
expectType<boolean[]>(<InferFieldBuilderType<typeof booleanCollectionField>>{});
expectType<boolean[] | null>(
  <InferFieldBuilderType<typeof booleanCollectionFieldNullable>>{}
);

// collection
const collectionField = collection("collection", {
  string: string("string").notNull(),
});
expectType<{ string: string }[]>(
  <InferFieldBuilderType<typeof collectionField>>{}
);

// complex
const complexField = complex("complex", {
  string: string("string").notNull(),
});
expectType<{ string: string }>(<InferFieldBuilderType<typeof complexField>>{});

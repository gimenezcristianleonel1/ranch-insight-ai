export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abortos: {
        Row: {
          causa: string | null
          created_at: string
          establecimiento_id: string
          fecha: string
          id: string
          vaca_id: string
        }
        Insert: {
          causa?: string | null
          created_at?: string
          establecimiento_id: string
          fecha?: string
          id?: string
          vaca_id: string
        }
        Update: {
          causa?: string | null
          created_at?: string
          establecimiento_id?: string
          fecha?: string
          id?: string
          vaca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abortos_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abortos_vaca_id_fkey"
            columns: ["vaca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      aforos: {
        Row: {
          altura_cm: number | null
          created_at: string
          establecimiento_id: string
          fecha: string
          id: string
          kg_ms_ha: number
          metodo: string | null
          observaciones: string | null
          potrero_id: string | null
          user_id: string | null
        }
        Insert: {
          altura_cm?: number | null
          created_at?: string
          establecimiento_id: string
          fecha?: string
          id?: string
          kg_ms_ha: number
          metodo?: string | null
          observaciones?: string | null
          potrero_id?: string | null
          user_id?: string | null
        }
        Update: {
          altura_cm?: number | null
          created_at?: string
          establecimiento_id?: string
          fecha?: string
          id?: string
          kg_ms_ha?: number
          metodo?: string | null
          observaciones?: string | null
          potrero_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aforos_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aforos_potrero_id_fkey"
            columns: ["potrero_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
        ]
      }
      aguadas: {
        Row: {
          capacidad_litros: number | null
          created_at: string
          establecimiento_id: string
          estado: string
          id: string
          lat: number | null
          lng: number | null
          nombre: string
          observaciones: string | null
          potrero_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          capacidad_litros?: number | null
          created_at?: string
          establecimiento_id: string
          estado?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nombre: string
          observaciones?: string | null
          potrero_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          capacidad_litros?: number | null
          created_at?: string
          establecimiento_id?: string
          estado?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nombre?: string
          observaciones?: string | null
          potrero_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aguadas_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aguadas_potrero_id_fkey"
            columns: ["potrero_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
        ]
      }
      alambrados: {
        Row: {
          created_at: string
          establecimiento_id: string
          estado: string
          hilos: number | null
          id: string
          km: number
          nombre: string
          observaciones: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          establecimiento_id: string
          estado?: string
          hilos?: number | null
          id?: string
          km?: number
          nombre: string
          observaciones?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          establecimiento_id?: string
          estado?: string
          hilos?: number | null
          id?: string
          km?: number
          nombre?: string
          observaciones?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alambrados_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      animales: {
        Row: {
          caravana: string
          categoria_id: string | null
          created_at: string
          establecimiento_id: string
          estado: string | null
          estado_reproductivo: string | null
          fecha_nacimiento: string | null
          id: string
          madre_id: string | null
          observaciones: string | null
          padre_id: string | null
          peso_actual: number | null
          potrero_id: string | null
          raza_id: string | null
          rfid: string | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          updated_at: string
        }
        Insert: {
          caravana: string
          categoria_id?: string | null
          created_at?: string
          establecimiento_id: string
          estado?: string | null
          estado_reproductivo?: string | null
          fecha_nacimiento?: string | null
          id?: string
          madre_id?: string | null
          observaciones?: string | null
          padre_id?: string | null
          peso_actual?: number | null
          potrero_id?: string | null
          raza_id?: string | null
          rfid?: string | null
          sexo: Database["public"]["Enums"]["sexo_animal"]
          updated_at?: string
        }
        Update: {
          caravana?: string
          categoria_id?: string | null
          created_at?: string
          establecimiento_id?: string
          estado?: string | null
          estado_reproductivo?: string | null
          fecha_nacimiento?: string | null
          id?: string
          madre_id?: string | null
          observaciones?: string | null
          padre_id?: string | null
          peso_actual?: number | null
          potrero_id?: string | null
          raza_id?: string | null
          rfid?: string | null
          sexo?: Database["public"]["Enums"]["sexo_animal"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animales_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_madre_id_fkey"
            columns: ["madre_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_padre_id_fkey"
            columns: ["padre_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_potrero_id_fkey"
            columns: ["potrero_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animales_raza_id_fkey"
            columns: ["raza_id"]
            isOneToOne: false
            referencedRelation: "razas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          created_at: string
          detalle: Json | null
          entidad: string
          entidad_id: string | null
          establecimiento_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalle?: Json | null
          entidad: string
          entidad_id?: string | null
          establecimiento_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: Json | null
          entidad?: string
          entidad_id?: string | null
          establecimiento_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ev: number
          id: string
          nombre: string
          orden: number
          requerimiento_ms: number
        }
        Insert: {
          ev?: number
          id?: string
          nombre: string
          orden?: number
          requerimiento_ms?: number
        }
        Update: {
          ev?: number
          id?: string
          nombre?: string
          orden?: number
          requerimiento_ms?: number
        }
        Relationships: []
      }
      destetes: {
        Row: {
          created_at: string
          created_by: string | null
          cria_id: string
          establecimiento_id: string
          fecha: string
          id: string
          observaciones: string | null
          peso_destete: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cria_id: string
          establecimiento_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_destete?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cria_id?: string
          establecimiento_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_destete?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "destetes_cria_id_fkey"
            columns: ["cria_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destetes_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          created_at: string
          created_by: string | null
          edad_fetal_dias: number | null
          establecimiento_id: string
          fecha: string
          id: string
          observaciones: string | null
          resultado: boolean
          vaca_id: string
          veterinario: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          edad_fetal_dias?: number | null
          establecimiento_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          resultado: boolean
          vaca_id: string
          veterinario?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          edad_fetal_dias?: number | null
          establecimiento_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          resultado?: boolean
          vaca_id?: string
          veterinario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosticos_vaca_id_fkey"
            columns: ["vaca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      establecimiento_miembros: {
        Row: {
          created_at: string
          establecimiento_id: string
          id: string
          rol: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          establecimiento_id: string
          id?: string
          rol?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          establecimiento_id?: string
          id?: string
          rol?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "establecimiento_miembros_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      establecimientos: {
        Row: {
          created_at: string
          fecha_alta: string | null
          id: string
          localidad: string | null
          nombre: string
          owner_id: string
          propietario: string | null
          provincia: string | null
          superficie_ganadera: number | null
          superficie_total: number | null
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha_alta?: string | null
          id?: string
          localidad?: string | null
          nombre: string
          owner_id: string
          propietario?: string | null
          provincia?: string | null
          superficie_ganadera?: number | null
          superficie_total?: number | null
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha_alta?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
          owner_id?: string
          propietario?: string | null
          provincia?: string | null
          superficie_ganadera?: number | null
          superficie_total?: number | null
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finanzas_categorias: {
        Row: {
          created_at: string
          establecimiento_id: string
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          created_at?: string
          establecimiento_id: string
          id?: string
          nombre: string
          tipo: string
        }
        Update: {
          created_at?: string
          establecimiento_id?: string
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "finanzas_categorias_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      finanzas_movimientos: {
        Row: {
          cantidad: number | null
          categoria_id: string | null
          concepto: string
          created_at: string
          establecimiento_id: string
          fecha: string
          id: string
          moneda: string
          monto: number
          observaciones: string | null
          tipo: string
          unidad: string | null
          user_id: string | null
        }
        Insert: {
          cantidad?: number | null
          categoria_id?: string | null
          concepto: string
          created_at?: string
          establecimiento_id: string
          fecha?: string
          id?: string
          moneda?: string
          monto: number
          observaciones?: string | null
          tipo: string
          unidad?: string | null
          user_id?: string | null
        }
        Update: {
          cantidad?: number | null
          categoria_id?: string | null
          concepto?: string
          created_at?: string
          establecimiento_id?: string
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          observaciones?: string | null
          tipo?: string
          unidad?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finanzas_movimientos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "finanzas_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finanzas_movimientos_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_alertas: {
        Row: {
          created_at: string
          establecimiento_id: string
          id: string
          mensaje: string
          prioridad: string
          resuelta: boolean
          tipo: string
        }
        Insert: {
          created_at?: string
          establecimiento_id: string
          id?: string
          mensaje: string
          prioridad?: string
          resuelta?: boolean
          tipo: string
        }
        Update: {
          created_at?: string
          establecimiento_id?: string
          id?: string
          mensaje?: string
          prioridad?: string
          resuelta?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_alertas_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_consultas: {
        Row: {
          created_at: string
          establecimiento_id: string | null
          id: string
          pregunta: string
          respuesta: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          establecimiento_id?: string | null
          id?: string
          pregunta: string
          respuesta?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          establecimiento_id?: string | null
          id?: string
          pregunta?: string
          respuesta?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_consultas_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos: {
        Row: {
          animal_id: string | null
          created_at: string
          created_by: string | null
          destino: string | null
          establecimiento_id: string
          fecha: string
          id: string
          observaciones: string | null
          origen: string | null
          potrero_destino_id: string | null
          potrero_origen_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          destino?: string | null
          establecimiento_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          origen?: string | null
          potrero_destino_id?: string | null
          potrero_origen_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          animal_id?: string | null
          created_at?: string
          created_by?: string | null
          destino?: string | null
          establecimiento_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          origen?: string | null
          potrero_destino_id?: string | null
          potrero_origen_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_potrero_destino_id_fkey"
            columns: ["potrero_destino_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_potrero_origen_id_fkey"
            columns: ["potrero_origen_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
        ]
      }
      pariciones: {
        Row: {
          created_at: string
          created_by: string | null
          cria_id: string | null
          establecimiento_id: string
          facilidad: Database["public"]["Enums"]["facilidad_parto"] | null
          fecha: string
          id: string
          observaciones: string | null
          peso_nacimiento: number | null
          sexo_cria: Database["public"]["Enums"]["sexo_animal"] | null
          vaca_id: string
          vivo: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cria_id?: string | null
          establecimiento_id: string
          facilidad?: Database["public"]["Enums"]["facilidad_parto"] | null
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_nacimiento?: number | null
          sexo_cria?: Database["public"]["Enums"]["sexo_animal"] | null
          vaca_id: string
          vivo?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cria_id?: string | null
          establecimiento_id?: string
          facilidad?: Database["public"]["Enums"]["facilidad_parto"] | null
          fecha?: string
          id?: string
          observaciones?: string | null
          peso_nacimiento?: number | null
          sexo_cria?: Database["public"]["Enums"]["sexo_animal"] | null
          vaca_id?: string
          vivo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pariciones_cria_id_fkey"
            columns: ["cria_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pariciones_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pariciones_vaca_id_fkey"
            columns: ["vaca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      pesadas: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          establecimiento_id: string
          fecha: string
          id: string
          observaciones: string | null
          peso: number
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          establecimiento_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          peso: number
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          establecimiento_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          peso?: number
        }
        Relationships: [
          {
            foreignKeyName: "pesadas_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesadas_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      potreros: {
        Row: {
          aguadas: number | null
          ambiente: string | null
          created_at: string
          establecimiento_id: string
          estado: string | null
          hectareas: number
          id: string
          nombre: string
          observaciones: string | null
          tipo_pastura: string | null
          tipo_suelo: string | null
          updated_at: string
        }
        Insert: {
          aguadas?: number | null
          ambiente?: string | null
          created_at?: string
          establecimiento_id: string
          estado?: string | null
          hectareas?: number
          id?: string
          nombre: string
          observaciones?: string | null
          tipo_pastura?: string | null
          tipo_suelo?: string | null
          updated_at?: string
        }
        Update: {
          aguadas?: number | null
          ambiente?: string | null
          created_at?: string
          establecimiento_id?: string
          estado?: string | null
          hectareas?: number
          id?: string
          nombre?: string
          observaciones?: string | null
          tipo_pastura?: string | null
          tipo_suelo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "potreros_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nombre: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      razas: {
        Row: {
          id: string
          nombre: string
        }
        Insert: {
          id?: string
          nombre: string
        }
        Update: {
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      sanidad: {
        Row: {
          animal_id: string
          costo: number | null
          created_at: string
          created_by: string | null
          dosis: number | null
          establecimiento_id: string
          fecha: string
          id: string
          observaciones: string | null
          producto: string
          tipo: Database["public"]["Enums"]["tipo_sanidad"]
          unidad: string | null
          veterinario: string | null
        }
        Insert: {
          animal_id: string
          costo?: number | null
          created_at?: string
          created_by?: string | null
          dosis?: number | null
          establecimiento_id: string
          fecha?: string
          id?: string
          observaciones?: string | null
          producto: string
          tipo?: Database["public"]["Enums"]["tipo_sanidad"]
          unidad?: string | null
          veterinario?: string | null
        }
        Update: {
          animal_id?: string
          costo?: number | null
          created_at?: string
          created_by?: string | null
          dosis?: number | null
          establecimiento_id?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          producto?: string
          tipo?: Database["public"]["Enums"]["tipo_sanidad"]
          unidad?: string | null
          veterinario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sanidad_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanidad_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          created_at: string
          created_by: string | null
          establecimiento_id: string
          fecha: string
          id: string
          lote: string | null
          observaciones: string | null
          tipo: Database["public"]["Enums"]["tipo_servicio"]
          toro_id: string | null
          vaca_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establecimiento_id: string
          fecha?: string
          id?: string
          lote?: string | null
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["tipo_servicio"]
          toro_id?: string | null
          vaca_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establecimiento_id?: string
          fecha?: string
          id?: string
          lote?: string | null
          observaciones?: string | null
          tipo?: Database["public"]["Enums"]["tipo_servicio"]
          toro_id?: string | null
          vaca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicios_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_toro_id_fkey"
            columns: ["toro_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicios_vaca_id_fkey"
            columns: ["vaca_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
        ]
      }
      tareas: {
        Row: {
          animal_id: string | null
          categoria: string | null
          completada_at: string | null
          created_by: string | null
          descripcion: string | null
          establecimiento_id: string
          estado: string
          fecha: string
          fecha_creacion: string
          hora: string | null
          id: string
          observaciones: string | null
          potrero_id: string | null
          prioridad: string
          responsable: string | null
          sanidad_id: string | null
          servicio_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          animal_id?: string | null
          categoria?: string | null
          completada_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          establecimiento_id: string
          estado?: string
          fecha: string
          fecha_creacion?: string
          hora?: string | null
          id?: string
          observaciones?: string | null
          potrero_id?: string | null
          prioridad?: string
          responsable?: string | null
          sanidad_id?: string | null
          servicio_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          animal_id?: string | null
          categoria?: string | null
          completada_at?: string | null
          created_by?: string | null
          descripcion?: string | null
          establecimiento_id?: string
          estado?: string
          fecha?: string
          fecha_creacion?: string
          hora?: string | null
          id?: string
          observaciones?: string | null
          potrero_id?: string | null
          prioridad?: string
          responsable?: string | null
          sanidad_id?: string | null
          servicio_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_establecimiento_id_fkey"
            columns: ["establecimiento_id"]
            isOneToOne: false
            referencedRelation: "establecimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_potrero_id_fkey"
            columns: ["potrero_id"]
            isOneToOne: false
            referencedRelation: "potreros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_sanidad_id_fkey"
            columns: ["sanidad_id"]
            isOneToOne: false
            referencedRelation: "sanidad"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tareas_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _est: string; _user: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "encargado" | "asesor" | "auditor"
      facilidad_parto: "sin_ayuda" | "ayuda_leve" | "ayuda_severa" | "cesarea"
      member_role: "propietario" | "encargado" | "operario" | "asesor"
      sexo_animal: "macho" | "hembra"
      tipo_movimiento:
        | "nacimiento"
        | "compra"
        | "venta"
        | "muerte"
        | "traslado"
        | "cambio_categoria"
      tipo_sanidad: "tratamiento" | "vacuna" | "antiparasitario" | "enfermedad"
      tipo_servicio: "natural" | "ia" | "iatf"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "encargado", "asesor", "auditor"],
      facilidad_parto: ["sin_ayuda", "ayuda_leve", "ayuda_severa", "cesarea"],
      member_role: ["propietario", "encargado", "operario", "asesor"],
      sexo_animal: ["macho", "hembra"],
      tipo_movimiento: [
        "nacimiento",
        "compra",
        "venta",
        "muerte",
        "traslado",
        "cambio_categoria",
      ],
      tipo_sanidad: ["tratamiento", "vacuna", "antiparasitario", "enfermedad"],
      tipo_servicio: ["natural", "ia", "iatf"],
    },
  },
} as const

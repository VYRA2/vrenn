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
      apoios: {
        Row: {
          created_at: string
          id: string
          meta_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apoios_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitros: {
        Row: {
          arbitro_id: string
          convidado_por: string
          created_at: string
          id: string
          meta_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arbitro_id: string
          convidado_por: string
          created_at?: string
          id?: string
          meta_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arbitro_id?: string
          convidado_por?: string
          created_at?: string
          id?: string
          meta_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitros_arbitro_id_profiles_fkey"
            columns: ["arbitro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitros_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_validacoes: {
        Row: {
          arbitro_id: string
          checkin_id: string
          comentario: string | null
          created_at: string
          id: string
          status: string
        }
        Insert: {
          arbitro_id: string
          checkin_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          status: string
        }
        Update: {
          arbitro_id?: string
          checkin_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_validacoes_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          data: string
          desafio_id: string | null
          dia: string | null
          duelo_id: string | null
          foto_url: string | null
          id: string
          is_seed: boolean
          mensagem: string | null
          meta_id: string | null
          user_id: string
          validado: boolean
          wearable_activity_id: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          desafio_id?: string | null
          dia?: string | null
          duelo_id?: string | null
          foto_url?: string | null
          id?: string
          is_seed?: boolean
          mensagem?: string | null
          meta_id?: string | null
          user_id: string
          validado?: boolean
          wearable_activity_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          desafio_id?: string | null
          dia?: string | null
          duelo_id?: string | null
          foto_url?: string | null
          id?: string
          is_seed?: boolean
          mensagem?: string | null
          meta_id?: string | null
          user_id?: string
          validado?: boolean
          wearable_activity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_duelo_id_fkey"
            columns: ["duelo_id"]
            isOneToOne: false
            referencedRelation: "duelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins_desafio_equipe: {
        Row: {
          created_at: string
          desafio_id: string
          foto_url: string | null
          id: string
          mensagem: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          desafio_id: string
          foto_url?: string | null
          id?: string
          mensagem?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          desafio_id?: string
          foto_url?: string | null
          id?: string
          mensagem?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_desafio_equipe_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      conquistas_usuarios: {
        Row: {
          desbloqueada_em: string | null
          id: string
          slug: string
          user_id: string
        }
        Insert: {
          desbloqueada_em?: string | null
          id?: string
          slug: string
          user_id: string
        }
        Update: {
          desbloqueada_em?: string | null
          id?: string
          slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conquistas_usuarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          created_at: string
          equipe_id: string | null
          id: string
          nome: string | null
          tipo: string | null
          ultima_mensagem: string | null
          ultima_mensagem_at: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          equipe_id?: string | null
          id?: string
          nome?: string | null
          tipo?: string | null
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string | null
          id?: string
          nome?: string | null
          tipo?: string | null
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      desafio_equipe_participantes: {
        Row: {
          created_at: string
          desafio_id: string
          eliminado: boolean | null
          eliminado_em: string | null
          id: string
          motivo_eliminacao: string | null
          progresso: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desafio_id: string
          eliminado?: boolean | null
          eliminado_em?: string | null
          id?: string
          motivo_eliminacao?: string | null
          progresso?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desafio_id?: string
          eliminado?: boolean | null
          eliminado_em?: string | null
          id?: string
          motivo_eliminacao?: string | null
          progresso?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_equipe_participantes_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      desafios_equipe: {
        Row: {
          categoria: string
          created_at: string
          criador_id: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          duracao_dias: number
          equipe_id: string
          frequencia_quantidade: number | null
          frequencia_tipo: string | null
          id: string
          is_seed: boolean
          local_id: string | null
          premiacao: string | null
          premio_acumulado: number
          regras: Json
          status: string
          tipo_validacao: string
          titulo: string
          valor_entrada: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          criador_id: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          duracao_dias?: number
          equipe_id: string
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          local_id?: string | null
          premiacao?: string | null
          premio_acumulado?: number
          regras?: Json
          status?: string
          tipo_validacao?: string
          titulo: string
          valor_entrada?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          criador_id?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          duracao_dias?: number
          equipe_id?: string
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          local_id?: string | null
          premiacao?: string | null
          premio_acumulado?: number
          regras?: Json
          status?: string
          tipo_validacao?: string
          titulo?: string
          valor_entrada?: number
        }
        Relationships: [
          {
            foreignKeyName: "desafios_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desafios_equipe_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_validacao"
            referencedColumns: ["id"]
          },
        ]
      }
      duelos: {
        Row: {
          categoria: string | null
          challenger_eliminado: boolean | null
          challenger_eliminado_em: string | null
          challenger_id: string
          created_at: string
          frequencia_quantidade: number | null
          frequencia_tipo: string | null
          id: string
          is_seed: boolean
          opponent_eliminado: boolean | null
          opponent_eliminado_em: string | null
          opponent_email: string | null
          opponent_id: string | null
          prazo: string | null
          progresso_challenger: number | null
          progresso_opponent: number | null
          status: string
          titulo: string
          valor_custodia: number | null
          winner_id: string | null
        }
        Insert: {
          categoria?: string | null
          challenger_eliminado?: boolean | null
          challenger_eliminado_em?: string | null
          challenger_id: string
          created_at?: string
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          opponent_eliminado?: boolean | null
          opponent_eliminado_em?: string | null
          opponent_email?: string | null
          opponent_id?: string | null
          prazo?: string | null
          progresso_challenger?: number | null
          progresso_opponent?: number | null
          status?: string
          titulo: string
          valor_custodia?: number | null
          winner_id?: string | null
        }
        Update: {
          categoria?: string | null
          challenger_eliminado?: boolean | null
          challenger_eliminado_em?: string | null
          challenger_id?: string
          created_at?: string
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          opponent_eliminado?: boolean | null
          opponent_eliminado_em?: string | null
          opponent_email?: string | null
          opponent_id?: string | null
          prazo?: string | null
          progresso_challenger?: number | null
          progresso_opponent?: number | null
          status?: string
          titulo?: string
          valor_custodia?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duelos_challenger_profile_fk"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duelos_opponent_profile_fk"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_membros: {
        Row: {
          created_at: string
          equipe_id: string
          id: string
          is_seed: boolean
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          id?: string
          is_seed?: boolean
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          id?: string
          is_seed?: boolean
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_membros_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          avatar_url: string | null
          categoria: string
          created_at: string
          criador_id: string
          descricao: string | null
          id: string
          is_seed: boolean
          nome: string
          publica: boolean
          regras: string | null
        }
        Insert: {
          avatar_url?: string | null
          categoria?: string
          created_at?: string
          criador_id: string
          descricao?: string | null
          id?: string
          is_seed?: boolean
          nome: string
          publica?: boolean
          regras?: string | null
        }
        Update: {
          avatar_url?: string | null
          categoria?: string
          created_at?: string
          criador_id?: string
          descricao?: string | null
          id?: string
          is_seed?: boolean
          nome?: string
          publica?: boolean
          regras?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          is_seed: boolean
          status: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          is_seed?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          is_seed?: boolean
          status?: string
        }
        Relationships: []
      }
      fundo_temporada: {
        Row: {
          data_inicio: string
          id: string
          meta_valor: number
          updated_at: string
          valor_acumulado: number
        }
        Insert: {
          data_inicio?: string
          id?: string
          meta_valor?: number
          updated_at?: string
          valor_acumulado?: number
        }
        Update: {
          data_inicio?: string
          id?: string
          meta_valor?: number
          updated_at?: string
          valor_acumulado?: number
        }
        Relationships: []
      }
      justificativas_falta: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          data_referencia: string
          desafio_id: string | null
          duelo_id: string | null
          id: string
          meta_id: string | null
          motivo: string
          respondido_em: string | null
          status: string
          user_id: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          data_referencia: string
          desafio_id?: string | null
          duelo_id?: string | null
          id?: string
          meta_id?: string | null
          motivo: string
          respondido_em?: string | null
          status?: string
          user_id: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          data_referencia?: string
          desafio_id?: string | null
          duelo_id?: string | null
          id?: string
          meta_id?: string | null
          motivo?: string
          respondido_em?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "justificativas_falta_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificativas_falta_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificativas_falta_duelo_id_fkey"
            columns: ["duelo_id"]
            isOneToOne: false
            referencedRelation: "duelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificativas_falta_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificativas_falta_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locais_validacao: {
        Row: {
          created_at: string
          criado_por: string
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          qrcode_token: string
          raio_geofence_metros: number
        }
        Insert: {
          created_at?: string
          criado_por: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          qrcode_token?: string
          raio_geofence_metros?: number
        }
        Update: {
          created_at?: string
          criado_por?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          qrcode_token?: string
          raio_geofence_metros?: number
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conversa_id: string
          created_at: string
          id: string
          lida: boolean
          sender_id: string
          texto: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          id?: string
          lida?: boolean
          sender_id: string
          texto: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          sender_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          foto_capa_url: string | null
          frequencia_quantidade: number | null
          frequencia_tipo: string | null
          id: string
          is_seed: boolean
          local_id: string | null
          motivacao: string | null
          prazo: string | null
          progresso: number
          status: string
          tipo_validacao: string
          titulo: string
          user_id: string
          valor_custodia: number | null
          valor_destino: string | null
          wearable_criterio: Json | null
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao?: string | null
          foto_capa_url?: string | null
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          local_id?: string | null
          motivacao?: string | null
          prazo?: string | null
          progresso?: number
          status?: string
          tipo_validacao?: string
          titulo: string
          user_id: string
          valor_custodia?: number | null
          valor_destino?: string | null
          wearable_criterio?: Json | null
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          foto_capa_url?: string | null
          frequencia_quantidade?: number | null
          frequencia_tipo?: string | null
          id?: string
          is_seed?: boolean
          local_id?: string | null
          motivacao?: string | null
          prazo?: string | null
          progresso?: number
          status?: string
          tipo_validacao?: string
          titulo?: string
          user_id?: string
          valor_custodia?: number | null
          valor_destino?: string | null
          wearable_criterio?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "locais_validacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          is_seed: boolean
          lida: boolean
          link_id: string | null
          mensagem: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_seed?: boolean
          lida?: boolean
          link_id?: string | null
          mensagem: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_seed?: boolean
          lida?: boolean
          link_id?: string | null
          mensagem?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          created_at: string
          id: string
          is_seed: boolean
          post_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_seed?: boolean
          post_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_seed?: boolean
          post_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          is_seed: boolean
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_seed?: boolean
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_seed?: boolean
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          auto_gerado: boolean
          contador: string | null
          created_at: string
          desafio_id: string | null
          hashtags: string[] | null
          id: string
          is_seed: boolean
          legenda: string | null
          media_url: string | null
          meta_id: string | null
          tipo: string
          titulo: string | null
          user_id: string
        }
        Insert: {
          auto_gerado?: boolean
          contador?: string | null
          created_at?: string
          desafio_id?: string | null
          hashtags?: string[] | null
          id?: string
          is_seed?: boolean
          legenda?: string | null
          media_url?: string | null
          meta_id?: string | null
          tipo?: string
          titulo?: string | null
          user_id: string
        }
        Update: {
          auto_gerado?: boolean
          contador?: string | null
          created_at?: string
          desafio_id?: string | null
          hashtags?: string[] | null
          id?: string
          is_seed?: boolean
          legenda?: string | null
          media_url?: string | null
          meta_id?: string | null
          tipo?: string
          titulo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          avatar_url: string | null
          bio: string | null
          categorias_interesse: string[] | null
          cpf: string | null
          created_at: string
          creditos: number
          id: string
          idioma: string
          is_seed: boolean
          missao: string | null
          nivel: number
          nome: string
          onboarding_done: boolean
          perfil_publico: boolean
          reputacao_pts: number
          streak_dias: number
          unidades: string
          username: string
        }
        Insert: {
          asaas_customer_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          categorias_interesse?: string[] | null
          cpf?: string | null
          created_at?: string
          creditos?: number
          id: string
          idioma?: string
          is_seed?: boolean
          missao?: string | null
          nivel?: number
          nome: string
          onboarding_done?: boolean
          perfil_publico?: boolean
          reputacao_pts?: number
          streak_dias?: number
          unidades?: string
          username: string
        }
        Update: {
          asaas_customer_id?: string | null
          avatar_url?: string | null
          bio?: string | null
          categorias_interesse?: string[] | null
          cpf?: string | null
          created_at?: string
          creditos?: number
          id?: string
          idioma?: string
          is_seed?: boolean
          missao?: string | null
          nivel?: number
          nome?: string
          onboarding_done?: boolean
          perfil_publico?: boolean
          reputacao_pts?: number
          streak_dias?: number
          unidades?: string
          username?: string
        }
        Relationships: []
      }
      reputacao_log: {
        Row: {
          created_at: string | null
          id: string
          motivo: string
          pontos: number
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          motivo: string
          pontos: number
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          motivo?: string
          pontos?: number
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputacao_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          media_url: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          media_url: string
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          media_url?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          asaas_transfer_id: string | null
          created_at: string
          description: string | null
          id: string
          is_seed: boolean
          meta_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          asaas_transfer_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_seed?: boolean
          meta_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          asaas_transfer_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_seed?: boolean
          meta_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_searches: {
        Row: {
          created_at: string
          id: string
          termo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          termo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          termo?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_seed: boolean
          locked_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_seed?: boolean
          locked_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_seed?: boolean
          locked_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_connections: {
        Row: {
          connected_at: string
          id: string
          open_wearables_user_id: string
          provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          open_wearables_user_id: string
          provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          open_wearables_user_id?: string
          provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          pix_key: string
          pix_key_type: string
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          pix_key: string
          pix_key_type: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          pix_key?: string
          pix_key_type?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dar_reputacao: {
        Args: {
          p_motivo: string
          p_pontos: number
          p_ref_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      desbloquear_conquista: {
        Args: { p_slug: string; p_user_id: string }
        Returns: undefined
      }
      distancia_metros: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      duelo_respond: {
        Args: { _accept: boolean; _duelo_id: string }
        Returns: undefined
      }
      duelo_update_progresso: {
        Args: { _duelo_id: string; _progresso: number }
        Returns: undefined
      }
      get_meta_motivacao: { Args: { _meta_id: string }; Returns: string }
      get_meta_valor_custodia: { Args: { _meta_id: string }; Returns: number }
      get_meta_valor_destino: { Args: { _meta_id: string }; Returns: string }
      get_meus_creditos: { Args: never; Returns: number }
      get_my_cpf: { Args: never; Returns: string }
      get_my_profile_stats: {
        Args: never
        Returns: {
          creditos: number
          nivel: number
          reputacao_pts: number
          streak_dias: number
        }[]
      }
      get_public_profile_stats: {
        Args: { _user_id: string }
        Returns: {
          ranking_geral: number
          reputacao_pts: number
          streak_dias: number
        }[]
      }
      is_equipe_member: {
        Args: { _equipe_id: string; _user_id: string }
        Returns: boolean
      }
      notify: {
        Args: {
          _link_id?: string
          _mensagem: string
          _tipo: string
          _user_id: string
        }
        Returns: string
      }
      processar_eliminacoes_diarias: { Args: never; Returns: undefined }
      resetar_streaks_quebrados: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
